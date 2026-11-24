using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using TrustGuard.Api.Analyses;
using TrustGuard.Api.Auth;
using TrustGuard.Api.Data;
using TrustGuard.Api.Infrastructure;
using TrustGuard.Api.Options;
using TrustGuard.Api.Settings;

var builder = WebApplication.CreateBuilder(args);

// ---- configuration ---------------------------------------------------------------------------------
// Secrets never live in the repository. Locally they come from user-secrets or environment variables;
// in Azure from Key Vault references. In development only, a missing JWT key becomes a random one per run.
var ephemeralKey = false;
if (builder.Environment.IsDevelopment() && string.IsNullOrWhiteSpace(builder.Configuration[$"{JwtOptions.SectionName}:SigningKey"]))
{
    builder.Configuration[$"{JwtOptions.SectionName}:SigningKey"] = Convert.ToBase64String(RandomNumberGenerator.GetBytes(48));
    ephemeralKey = true;
}

builder.Services.AddOptions<JwtOptions>().BindConfiguration(JwtOptions.SectionName).ValidateDataAnnotations().ValidateOnStart();
builder.Services.AddOptions<CookieSettings>().BindConfiguration(CookieSettings.SectionName).ValidateOnStart();
builder.Services.AddOptions<SecurityOptions>().BindConfiguration(SecurityOptions.SectionName).ValidateDataAnnotations().ValidateOnStart();
builder.Services.AddOptions<DatabaseOptions>().BindConfiguration(DatabaseOptions.SectionName);

var security = builder.Configuration.GetSection(SecurityOptions.SectionName).Get<SecurityOptions>() ?? new SecurityOptions();

// ---- data ------------------------------------------------------------------------------------------
var connectionString = builder.Configuration.GetConnectionString("Default")
    ?? throw new InvalidOperationException("ConnectionStrings:Default is not configured. Set ConnectionStrings__Default (see .env.example).");
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(ConnectionStrings.Normalize(connectionString)).UseSnakeCaseNamingConvention());

// ---- security --------------------------------------------------------------------------------------
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IPasswordHasher<User>>(_ => new PasswordHasher<User>(Microsoft.Extensions.Options.Options.Create(new PasswordHasherOptions { IterationCount = security.PasswordHashIterations })));
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<AuthCookies>();
builder.Services.AddScoped<SessionService>();
builder.Services.AddScoped<HistoryRecorder>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ClaimsPrincipalAccessor>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer();
builder.Services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
    .Configure<IOptions<JwtOptions>, IOptions<CookieSettings>, TimeProvider>((bearer, jwt, cookies, clock) =>
    {
        bearer.MapInboundClaims = false;
        bearer.RequireHttpsMetadata = false;
        bearer.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Value.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Value.Audience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Value.SigningKey)),
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256],
            ClockSkew = TimeSpan.FromSeconds(30),
            // Validated against the injected clock, not the machine clock, so expiry is testable and consistent.
            LifetimeValidator = (notBefore, expires, _, parameters) =>
            {
                var now = clock.GetUtcNow().UtcDateTime;
                return (notBefore is null || notBefore.Value <= now + parameters.ClockSkew) && (expires is null || expires.Value > now - parameters.ClockSkew);
            },
        };
        // The browser sends the token as an HttpOnly cookie; API clients may use an Authorization header instead.
        bearer.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                if (string.IsNullOrEmpty(context.Token) && context.Request.Cookies.TryGetValue(cookies.Value.AccessCookie, out var token)) context.Token = token;
                return Task.CompletedTask;
            },
        };
    });
builder.Services.AddAuthorization();
builder.Services.AddApiRateLimiting(security);

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto | ForwardedHeaders.XForwardedHost;
    foreach (var network in security.TrustedProxyNetworks) options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(network));
});

// ---- API surface -----------------------------------------------------------------------------------
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter(JsonNamingPolicy.SnakeCaseLower));
});
// Without this, only Development turns a malformed body into an exception; other environments would answer
// with the framework's bare 400. One error contract in every environment means the web app can rely on `code`.
builder.Services.Configure<Microsoft.AspNetCore.Routing.RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);
builder.Services.AddValidation();
builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = ApiExceptionHandler.Customize);
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database", tags: ["ready"]);
builder.Services.AddHostedService<RetentionCleanupService>();

var app = builder.Build();

if (ephemeralKey) app.Logger.LogWarning("No Jwt:SigningKey configured: using a random key for this run. Sessions end when the API restarts.");

if (app.Configuration.GetValue<bool>($"{DatabaseOptions.SectionName}:MigrateOnStartup"))
{
    // Migrations use a direct connection when one is configured (poolers cannot hold the migration lock).
    var migrationConnection = ConnectionStrings.Normalize(app.Configuration.GetConnectionString("Migrations") ?? connectionString);
    var migrationOptions = new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(migrationConnection).UseSnakeCaseNamingConvention().Options;
    await using var migrationContext = new AppDbContext(migrationOptions);
    await migrationContext.Database.MigrateAsync();
    app.Logger.LogInformation("Database migrations applied");
}

// ---- pipeline --------------------------------------------------------------------------------------
app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseStatusCodePages();
if (!app.Environment.IsDevelopment()) app.UseHsts();
app.UseMiddleware<SecurityHeadersMiddleware>();
app.UseAuthentication();
app.UseMiddleware<CsrfProtectionMiddleware>();
app.UseRateLimiter();
app.UseAuthorization();

app.MapOpenApi("/api/openapi.json");
app.MapHealthEndpoints();
app.MapAuthEndpoints();
app.MapAnalysisEndpoints();
app.MapHistoryEndpoints();
app.MapSettingsEndpoints();

await app.RunAsync();

/// <summary>Public so integration tests can host the API in memory.</summary>
public partial class Program;
