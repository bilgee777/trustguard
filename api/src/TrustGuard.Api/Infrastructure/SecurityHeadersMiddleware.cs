namespace TrustGuard.Api.Infrastructure;

/// <summary>Defensive headers for a JSON API: it never serves HTML, never needs to be framed, and responses must not be cached.</summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext context)
    {
        context.Response.OnStarting(() =>
        {
            var headers = context.Response.Headers;
            headers["X-Content-Type-Options"] = "nosniff";
            headers["Referrer-Policy"] = "no-referrer";
            headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'";
            headers["Cross-Origin-Resource-Policy"] = "same-origin";
            if (!headers.ContainsKey("Cache-Control")) headers["Cache-Control"] = "no-store";
            return Task.CompletedTask;
        });
        return next(context);
    }
}
