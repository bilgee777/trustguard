using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrustGuard.Api.Data;

namespace TrustGuard.Api.Auth;

public static class ClaimsPrincipalExtensions
{
    /// <summary>The user id from the JWT "sub" claim, or null for an anonymous caller.</summary>
    public static Guid? GetUserId(this ClaimsPrincipal principal) =>
        Guid.TryParse(principal.FindFirstValue("sub"), out var id) ? id : null;
}

public static class AuthEndpoints
{
    public static IResult Problem(AuthFailure failure, HttpResponse response)
    {
        if (failure.RetryAfter is { } retryAfter) response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString(System.Globalization.CultureInfo.InvariantCulture);
        return Results.Problem(
            statusCode: failure.Status,
            title: failure.Status switch { 400 => "Invalid request", 401 => "Not signed in", 409 => "Conflict", 429 => "Too many attempts", _ => "Request failed" },
            detail: failure.Message,
            extensions: new Dictionary<string, object?> { ["code"] = failure.Code });
    }

    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Authentication");

        group.MapGet("/csrf", (HttpContext context, AuthCookies cookies) => TypedResults.Ok(new CsrfResponse(cookies.IssueCsrf(context.Response))))
            .WithSummary("Issues a CSRF token cookie. Send its value back in the X-CSRF-Token header on state-changing requests.");

        group.MapPost("/register", async (RegisterRequest request, SessionService sessions, HttpContext context, CancellationToken ct) =>
            {
                var outcome = await sessions.RegisterAsync(request, context.Response, ct);
                return outcome.User is { } user ? Results.Json(UserDto.From(user), statusCode: StatusCodes.Status201Created) : Problem(outcome.Failure!, context.Response);
            })
            .RequireRateLimiting("auth")
            .WithSummary("Creates an account and starts a session.");

        group.MapPost("/login", async (LoginRequest request, SessionService sessions, HttpContext context, CancellationToken ct) =>
            {
                var outcome = await sessions.LoginAsync(request, context.Response, ct);
                return outcome.User is { } user ? Results.Ok(UserDto.From(user)) : Problem(outcome.Failure!, context.Response);
            })
            .RequireRateLimiting("auth")
            .WithSummary("Signs in with email and password.");

        group.MapPost("/refresh", async (SessionService sessions, HttpContext context, CancellationToken ct) =>
            {
                var outcome = await sessions.RefreshAsync(context.Request, context.Response, ct);
                return outcome.User is { } user ? Results.Ok(UserDto.From(user)) : Problem(outcome.Failure!, context.Response);
            })
            .RequireRateLimiting("auth")
            .WithSummary("Rotates the refresh token and issues a new access token.");

        group.MapPost("/logout", async (SessionService sessions, HttpContext context, CancellationToken ct) =>
            {
                await sessions.LogoutAsync(context.Request, context.Response, ct);
                return Results.NoContent();
            })
            .WithSummary("Ends the session and clears its cookies.");

        group.MapGet("/me", async ([FromServices] AppDbContext db, ClaimsPrincipal principal, CancellationToken ct) =>
            {
                var id = principal.GetUserId();
                var user = id is null ? null : await db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.Id == id, ct);
                return user is null ? Results.Problem(statusCode: 401, title: "Not signed in", extensions: new Dictionary<string, object?> { ["code"] = "no_session" }) : Results.Ok(UserDto.From(user));
            })
            .RequireAuthorization()
            .WithSummary("The signed-in user and their settings.");

        return app;
    }
}
