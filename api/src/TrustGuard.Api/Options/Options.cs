using System.ComponentModel.DataAnnotations;

namespace TrustGuard.Api.Options;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    [Required]
    public string Issuer { get; init; } = "trustguard";

    [Required]
    public string Audience { get; init; } = "trustguard-web";

    /// <summary>HMAC-SHA256 key. At least 32 characters; there is deliberately no default.</summary>
    [Required, MinLength(32)]
    public string SigningKey { get; init; } = "";

    [Range(1, 60)]
    public int AccessTokenMinutes { get; init; } = 15;

    [Range(1, 90)]
    public int RefreshTokenDays { get; init; } = 14;
}

public sealed class CookieSettings
{
    public const string SectionName = "Cookies";

    /// <summary>Secure cookies are the default; only local plain-HTTP development turns this off.</summary>
    public bool Secure { get; init; } = true;

    public string AccessCookie { get; init; } = "tg_access";

    public string RefreshCookie { get; init; } = "tg_refresh";

    public string CsrfCookie { get; init; } = "tg_csrf";
}

public sealed class SecurityOptions
{
    public const string SectionName = "Security";

    /// <summary>Extra origins allowed to make state-changing requests (the web app's own origin is always allowed).</summary>
    public string[] AllowedOrigins { get; init; } = [];

    /// <summary>CIDR ranges of reverse proxies whose X-Forwarded-* headers are trusted, e.g. "172.16.0.0/12".</summary>
    public string[] TrustedProxyNetworks { get; init; } = [];

    [Range(1, 100_000)]
    public int AnonymousAnalysesPerMinute { get; init; } = 30;

    [Range(1, 100_000)]
    public int AuthenticatedAnalysesPerMinute { get; init; } = 120;

    [Range(1, 100_000)]
    public int AuthAttemptsPerMinute { get; init; } = 10;

    /// <summary>PBKDF2-HMAC-SHA512 iterations (OWASP guidance: at least 210,000). Tests lower this for speed.</summary>
    [Range(1000, 2_000_000)]
    public int PasswordHashIterations { get; init; } = 210_000;
}

public sealed class DatabaseOptions
{
    public const string SectionName = "Database";

    /// <summary>Apply pending migrations when the API starts. Convenient locally, explicit in production.</summary>
    public bool MigrateOnStartup { get; init; }
}
