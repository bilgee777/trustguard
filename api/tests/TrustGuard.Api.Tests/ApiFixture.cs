using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Time.Testing;
using Testcontainers.PostgreSql;
using TrustGuard.Api.Data;

namespace TrustGuard.Api.Tests;

/// <summary>
/// Boots the real API in memory against a real PostgreSQL container. The schema is created by the actual
/// EF Core migrations (Database:MigrateOnStartup), so tests also prove that the migrations work.
/// The clock is fake, so token expiry, the refresh grace window and data retention can be tested without sleeping.
/// </summary>
public sealed class ApiFixture : WebApplicationFactory<Program>, IAsyncLifetime
{
    public const string TestSigningKey = "test-signing-key-test-signing-key-0123456789";

    private readonly PostgreSqlContainer _database = new PostgreSqlBuilder("postgres:18-alpine").Build();

    public FakeTimeProvider Clock { get; } = new(DateTimeOffset.UtcNow);

    async Task IAsyncLifetime.InitializeAsync() => await _database.StartAsync();

    async Task IAsyncLifetime.DisposeAsync()
    {
        await base.DisposeAsync();
        await _database.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Default", _database.GetConnectionString());
        builder.UseSetting("Database:MigrateOnStartup", "true");
        builder.UseSetting("Jwt:SigningKey", TestSigningKey);
        builder.UseSetting("Cookies:Secure", "false");
        builder.UseSetting("Security:PasswordHashIterations", "1000");
        builder.UseSetting("Security:AnonymousAnalysesPerMinute", "1000");
        builder.UseSetting("Security:AuthenticatedAnalysesPerMinute", "1000");
        builder.UseSetting("Security:AuthAttemptsPerMinute", "1000");
        builder.UseSetting("Security:AllowedOrigins:0", "http://allowed.example");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Clock);
        });
    }

    public TestSession NewSession(WebApplicationFactory<Program>? factory = null) =>
        new((factory ?? this).CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = false }));

    public async Task<T> WithDbAsync<T>(Func<AppDbContext, Task<T>> action, WebApplicationFactory<Program>? factory = null)
    {
        await using var scope = (factory ?? this).Services.CreateAsyncScope();
        return await action(scope.ServiceProvider.GetRequiredService<AppDbContext>());
    }
}

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<ApiFixture>
{
    public const string Name = "api";
}
