using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Options;
using TrustGuard.Api.Options;

namespace TrustGuard.Api.Auth;

/// <summary>
/// Two layers against cross-site request forgery for cookie-authenticated calls:
/// 1. Origin check: a state-changing request carrying an Origin header must come from this site or an allow-listed one.
/// 2. Double-submit token: if the request carries session cookies, the X-CSRF-Token header must equal the CSRF cookie.
///    A forged request cannot read the cookie, so it cannot produce the header.
/// SameSite=Strict on the session cookies is the first line of defense; these checks cover older browsers and mistakes.
/// Requests that authenticate with an Authorization header carry no ambient credentials and are not CSRF-able.
/// </summary>
public sealed class CsrfProtectionMiddleware(RequestDelegate next, IOptions<SecurityOptions> security, AuthCookies cookies)
{
    private static readonly HashSet<string> SafeMethods = new(["GET", "HEAD", "OPTIONS", "TRACE"], StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> _allowedOrigins = new(security.Value.AllowedOrigins.Select(o => o.TrimEnd('/')), StringComparer.OrdinalIgnoreCase);

    public async Task InvokeAsync(HttpContext context)
    {
        if (SafeMethods.Contains(context.Request.Method))
        {
            await next(context);
            return;
        }

        if (!OriginAllowed(context.Request))
        {
            await Reject(context, "origin_not_allowed", "This request came from an origin that is not allowed.");
            return;
        }

        var hasSessionCookie = context.Request.Cookies.ContainsKey(cookies.AccessName) || context.Request.Cookies.ContainsKey(cookies.RefreshName);
        if (hasSessionCookie && !CsrfTokenValid(context.Request))
        {
            await Reject(context, "csrf_token_invalid", "The CSRF token is missing or does not match. Reload the page and try again.");
            return;
        }

        await next(context);
    }

    private bool OriginAllowed(HttpRequest request)
    {
        if (!request.Headers.TryGetValue("Origin", out var origin) || origin.Count == 0) return true;
        var value = origin[0]!.TrimEnd('/');
        if (_allowedOrigins.Contains(value)) return true;
        return string.Equals(value, $"{request.Scheme}://{request.Host}", StringComparison.OrdinalIgnoreCase);
    }

    private bool CsrfTokenValid(HttpRequest request)
    {
        if (!request.Cookies.TryGetValue(cookies.CsrfName, out var cookie) || string.IsNullOrEmpty(cookie)) return false;
        var header = request.Headers["X-CSRF-Token"].ToString();
        return header.Length > 0 && CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(cookie), Encoding.UTF8.GetBytes(header));
    }

    private static Task Reject(HttpContext context, string code, string detail)
    {
        context.Response.StatusCode = StatusCodes.Status403Forbidden;
        return context.Response.WriteAsJsonAsync(new Microsoft.AspNetCore.Mvc.ProblemDetails
        {
            Status = 403,
            Title = "Request blocked",
            Detail = detail,
            Extensions = { ["code"] = code },
        });
    }
}
