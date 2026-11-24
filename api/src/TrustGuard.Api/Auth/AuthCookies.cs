using Microsoft.Extensions.Options;
using TrustGuard.Api.Options;

namespace TrustGuard.Api.Auth;

/// <summary>
/// Cookie design. Both session cookies are HttpOnly, so a script injected into the page cannot read them,
/// and SameSite=Strict, so the browser never attaches them to a request started from another site.
/// The access cookie is scoped to /api and the refresh cookie to /api/auth, so the long-lived token is
/// only sent to the one endpoint that needs it. The CSRF cookie is the only one JavaScript may read.
/// </summary>
public sealed class AuthCookies(IOptions<CookieSettings> options)
{
    private readonly CookieSettings _settings = options.Value;

    public string AccessName => _settings.AccessCookie;
    public string RefreshName => _settings.RefreshCookie;
    public string CsrfName => _settings.CsrfCookie;

    private CookieOptions Build(string path, bool httpOnly, DateTimeOffset? expires) => new()
    {
        HttpOnly = httpOnly,
        Secure = _settings.Secure,
        SameSite = SameSiteMode.Strict,
        Path = path,
        Expires = expires,
        IsEssential = true,
    };

    public void SetSession(HttpResponse response, string accessToken, DateTimeOffset accessExpires, string refreshToken, DateTimeOffset refreshExpires)
    {
        response.Cookies.Append(_settings.AccessCookie, accessToken, Build("/api", httpOnly: true, accessExpires));
        response.Cookies.Append(_settings.RefreshCookie, refreshToken, Build("/api/auth", httpOnly: true, refreshExpires));
        IssueCsrf(response);
    }

    /// <summary>A fresh double-submit token. The SPA copies this cookie's value into the X-CSRF-Token header.</summary>
    public string IssueCsrf(HttpResponse response)
    {
        var token = TokenService.NewOpaqueToken();
        response.Cookies.Append(_settings.CsrfCookie, token, Build("/", httpOnly: false, expires: null));
        return token;
    }

    public void Clear(HttpResponse response)
    {
        response.Cookies.Delete(_settings.AccessCookie, Build("/api", true, null));
        response.Cookies.Delete(_settings.RefreshCookie, Build("/api/auth", true, null));
        response.Cookies.Delete(_settings.CsrfCookie, Build("/", false, null));
    }
}
