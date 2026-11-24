using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;
using TrustGuard.Api.Data;
using TrustGuard.Api.Options;

namespace TrustGuard.Api.Auth;

/// <summary>Why a session operation failed. Mapped to a ProblemDetails response by the endpoints.</summary>
public sealed record AuthFailure(int Status, string Code, string Message, TimeSpan? RetryAfter = null);

public sealed record AuthOutcome(User? User, AuthFailure? Failure)
{
    public static AuthOutcome Ok(User user) => new(user, null);

    public static AuthOutcome Fail(int status, string code, string message, TimeSpan? retryAfter = null) =>
        new(null, new AuthFailure(status, code, message, retryAfter));
}

public sealed class SessionService(
    AppDbContext db,
    TokenService tokens,
    AuthCookies cookies,
    IPasswordHasher<User> hasher,
    IOptions<JwtOptions> jwt,
    TimeProvider clock,
    ILogger<SessionService> logger)
{
    private const int MaxFailedLogins = 5;
    private static readonly TimeSpan LockoutDuration = TimeSpan.FromMinutes(15);

    /// <summary>A second refresh arriving this soon after a rotation is a concurrent tab, not a stolen token.</summary>
    private static readonly TimeSpan RefreshGrace = TimeSpan.FromSeconds(10);

    private readonly JwtOptions _jwt = jwt.Value;

    // Verifying against this when the email is unknown keeps login time the same whether or not the account exists.
    private static readonly User DummyUser = new() { Id = Guid.Empty, Email = "", DisplayName = "", PasswordHash = "", CreatedAt = DateTimeOffset.UnixEpoch };
    private string? _dummyHash;

    private string DummyHash => _dummyHash ??= hasher.HashPassword(DummyUser, "not-a-real-password");

    public async Task<AuthOutcome> RegisterAsync(RegisterRequest request, HttpResponse response, CancellationToken ct)
    {
        var email = PasswordPolicy.NormalizeEmail(request.Email);
        if (email is null) return AuthOutcome.Fail(400, "invalid_email", "Enter a valid email address.");

        var passwordProblem = PasswordPolicy.Validate(request.Password, email);
        if (passwordProblem is not null) return AuthOutcome.Fail(400, "weak_password", passwordProblem);

        if (await db.Users.AnyAsync(u => u.Email == email, ct))
        {
            return AuthOutcome.Fail(409, "email_taken", "An account with this email already exists. Sign in instead.");
        }

        var now = clock.GetUtcNow();
        var user = new User
        {
            Id = Guid.CreateVersion7(),
            Email = email,
            DisplayName = request.DisplayName.Trim(),
            PasswordHash = "",
            CreatedAt = now,
            LastLoginAt = now,
        };
        user.PasswordHash = hasher.HashPassword(user, request.Password);
        db.Users.Add(user);
        IssueSession(user, Guid.CreateVersion7(), response);

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return AuthOutcome.Fail(409, "email_taken", "An account with this email already exists. Sign in instead.");
        }
        return AuthOutcome.Ok(user);
    }

    public async Task<AuthOutcome> LoginAsync(LoginRequest request, HttpResponse response, CancellationToken ct)
    {
        const string invalid = "Email or password is incorrect.";
        var email = PasswordPolicy.NormalizeEmail(request.Email);
        var user = email is null ? null : await db.Users.SingleOrDefaultAsync(u => u.Email == email, ct);

        if (user is null)
        {
            hasher.VerifyHashedPassword(DummyUser, DummyHash, request.Password);
            return AuthOutcome.Fail(401, "invalid_credentials", invalid);
        }

        var now = clock.GetUtcNow();
        if (user.LockedUntil is { } lockedUntil && lockedUntil > now)
        {
            return AuthOutcome.Fail(429, "too_many_attempts", "Too many failed sign-in attempts. Try again later.", lockedUntil - now);
        }

        var verification = hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verification == PasswordVerificationResult.Failed)
        {
            user.FailedLoginCount++;
            if (user.FailedLoginCount >= MaxFailedLogins)
            {
                user.LockedUntil = now + LockoutDuration;
                user.FailedLoginCount = 0;
                logger.LogWarning("Account {UserId} locked after repeated failed sign-ins", user.Id);
            }
            await db.SaveChangesAsync(ct);
            return AuthOutcome.Fail(401, "invalid_credentials", invalid);
        }

        if (verification == PasswordVerificationResult.SuccessRehashNeeded) user.PasswordHash = hasher.HashPassword(user, request.Password);
        user.FailedLoginCount = 0;
        user.LockedUntil = null;
        user.LastLoginAt = now;
        IssueSession(user, Guid.CreateVersion7(), response);
        await db.SaveChangesAsync(ct);
        return AuthOutcome.Ok(user);
    }

    public async Task<AuthOutcome> RefreshAsync(HttpRequest request, HttpResponse response, CancellationToken ct)
    {
        if (!request.Cookies.TryGetValue(cookies.RefreshName, out var raw) || string.IsNullOrEmpty(raw))
        {
            return AuthOutcome.Fail(401, "no_session", "You are not signed in.");
        }

        var hash = TokenService.Hash(raw);
        var current = await db.RefreshTokens.SingleOrDefaultAsync(t => t.TokenHash == hash, ct);
        if (current is null)
        {
            cookies.Clear(response);
            return AuthOutcome.Fail(401, "invalid_session", "Your session is no longer valid. Sign in again.");
        }

        var now = clock.GetUtcNow();
        if (current.RevokedAt is { } revokedAt)
        {
            if (current.ReplacedById is not null && now - revokedAt < RefreshGrace)
            {
                return AuthOutcome.Fail(409, "refresh_in_progress", "The session was just refreshed. Retry the request.");
            }

            // A rotated token is being replayed: assume it was stolen and end every session in this family.
            await db.RefreshTokens
                .Where(t => t.FamilyId == current.FamilyId && t.RevokedAt == null)
                .ExecuteUpdateAsync(set => set.SetProperty(t => t.RevokedAt, now), ct);
            logger.LogWarning("Refresh token reuse detected for user {UserId}; token family revoked", current.UserId);
            cookies.Clear(response);
            return AuthOutcome.Fail(401, "session_revoked", "Your session was ended for security reasons. Sign in again.");
        }

        if (current.ExpiresAt <= now)
        {
            cookies.Clear(response);
            return AuthOutcome.Fail(401, "session_expired", "Your session expired. Sign in again.");
        }

        var user = await db.Users.SingleOrDefaultAsync(u => u.Id == current.UserId, ct);
        if (user is null)
        {
            cookies.Clear(response);
            return AuthOutcome.Fail(401, "invalid_session", "Your session is no longer valid. Sign in again.");
        }

        var next = IssueSession(user, current.FamilyId, response);
        current.RevokedAt = now;
        current.ReplacedById = next.Id;
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            return AuthOutcome.Fail(409, "refresh_in_progress", "The session was just refreshed. Retry the request.");
        }
        return AuthOutcome.Ok(user);
    }

    public async Task LogoutAsync(HttpRequest request, HttpResponse response, CancellationToken ct)
    {
        if (request.Cookies.TryGetValue(cookies.RefreshName, out var raw) && !string.IsNullOrEmpty(raw))
        {
            var hash = TokenService.Hash(raw);
            var familyId = await db.RefreshTokens.Where(t => t.TokenHash == hash).Select(t => (Guid?)t.FamilyId).SingleOrDefaultAsync(ct);
            if (familyId is { } family)
            {
                var now = clock.GetUtcNow();
                await db.RefreshTokens.Where(t => t.FamilyId == family && t.RevokedAt == null).ExecuteUpdateAsync(set => set.SetProperty(t => t.RevokedAt, now), ct);
            }
        }
        cookies.Clear(response);
    }

    private RefreshToken IssueSession(User user, Guid familyId, HttpResponse response)
    {
        var now = clock.GetUtcNow();
        var refreshExpires = now.AddDays(_jwt.RefreshTokenDays);
        var raw = TokenService.NewOpaqueToken();
        var refresh = new RefreshToken
        {
            Id = Guid.CreateVersion7(),
            UserId = user.Id,
            TokenHash = TokenService.Hash(raw),
            FamilyId = familyId,
            CreatedAt = now,
            ExpiresAt = refreshExpires,
        };
        db.RefreshTokens.Add(refresh);

        var (access, accessExpires) = tokens.CreateAccessToken(user);
        cookies.SetSession(response, access, accessExpires, raw, refreshExpires);
        return refresh;
    }
}
