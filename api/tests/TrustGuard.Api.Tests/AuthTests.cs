using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;

namespace TrustGuard.Api.Tests;

[Collection(ApiCollection.Name)]
public class AuthTests(ApiFixture api)
{
    [Fact]
    public async Task RegisterStartsASessionWithHardenedCookies()
    {
        var session = api.NewSession();
        var response = await session.RegisterAsync("  New.User@Example.COM ");

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await TestSession.JsonAsync(response);
        Assert.Equal("new.user@example.com", body.GetProperty("email").GetString());
        Assert.Equal("off", body.GetProperty("settings").GetProperty("historyMode").GetString());

        // Tokens travel in cookies only: nothing a script could read ever appears in a response body.
        Assert.DoesNotContain(session.Cookie("tg_access")!, body.GetRawText(), StringComparison.Ordinal);

        var setCookies = response.Headers.GetValues("Set-Cookie").ToList();
        var access = Assert.Single(setCookies, c => c.StartsWith("tg_access=", StringComparison.Ordinal));
        var refresh = Assert.Single(setCookies, c => c.StartsWith("tg_refresh=", StringComparison.Ordinal));
        var csrf = Assert.Single(setCookies, c => c.StartsWith("tg_csrf=", StringComparison.Ordinal));

        Assert.Contains("httponly", access, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("samesite=strict", access, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/api", access, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("httponly", refresh, StringComparison.OrdinalIgnoreCase);
        Assert.Contains("path=/api/auth", refresh, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("httponly", csrf, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task RegisterRejectsWeakPasswordsAndBadEmails()
    {
        var session = api.NewSession();
        await session.GetAsync("/api/auth/csrf");

        var weak = await session.PostAsync("/api/auth/register", new { email = TestSession.NewEmail(), password = "short", displayName = "A" });
        Assert.Equal(HttpStatusCode.BadRequest, weak.StatusCode);
        Assert.Equal("weak_password", (await TestSession.JsonAsync(weak)).GetProperty("code").GetString());

        var common = await session.PostAsync("/api/auth/register", new { email = TestSession.NewEmail(), password = "password123", displayName = "A" });
        Assert.Equal("weak_password", (await TestSession.JsonAsync(common)).GetProperty("code").GetString());

        var containsEmail = await session.PostAsync("/api/auth/register", new { email = "janedoe@example.com", password = "janedoe-2026-ok", displayName = "A" });
        Assert.Equal("weak_password", (await TestSession.JsonAsync(containsEmail)).GetProperty("code").GetString());

        var badEmail = await session.PostAsync("/api/auth/register", new { email = "not-an-email", password = TestSession.Password, displayName = "A" });
        Assert.Equal("invalid_email", (await TestSession.JsonAsync(badEmail)).GetProperty("code").GetString());
    }

    [Fact]
    public async Task RegisterRejectsDuplicateEmailsRegardlessOfCase()
    {
        var email = TestSession.NewEmail();
        await api.NewSession().RegisteredAsync(email);

        var duplicate = await api.NewSession().RegisterAsync(email.ToUpperInvariant());
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
        Assert.Equal("email_taken", (await TestSession.JsonAsync(duplicate)).GetProperty("code").GetString());
    }

    [Fact]
    public async Task PasswordIsStoredOnlyAsAHash()
    {
        var email = TestSession.NewEmail();
        await api.NewSession().RegisteredAsync(email);

        var hash = await api.WithDbAsync(db => Task.FromResult(db.Users.Single(u => u.Email == email).PasswordHash));
        Assert.DoesNotContain(TestSession.Password, hash, StringComparison.Ordinal);
        Assert.True(hash.Length > 40);
    }

    [Fact]
    public async Task LoginSucceedsAndMeReturnsTheUser()
    {
        var email = TestSession.NewEmail();
        await api.NewSession().RegisteredAsync(email);

        var session = api.NewSession();
        var login = await session.LoginAsync(email);
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);

        var me = await session.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        Assert.Equal(email, (await TestSession.JsonAsync(me)).GetProperty("email").GetString());
    }

    [Fact]
    public async Task LoginFailureIsIdenticalForWrongPasswordAndUnknownEmail()
    {
        var email = TestSession.NewEmail();
        await api.NewSession().RegisteredAsync(email);

        var wrongPassword = await api.NewSession().LoginAsync(email, "definitely the wrong one");
        var unknownEmail = await api.NewSession().LoginAsync(TestSession.NewEmail());

        Assert.Equal(HttpStatusCode.Unauthorized, wrongPassword.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, unknownEmail.StatusCode);
        var a = await TestSession.JsonAsync(wrongPassword);
        var b = await TestSession.JsonAsync(unknownEmail);
        Assert.Equal(a.GetProperty("detail").GetString(), b.GetProperty("detail").GetString());
        Assert.Equal(a.GetProperty("code").GetString(), b.GetProperty("code").GetString());
    }

    [Fact]
    public async Task AccountLocksAfterRepeatedFailuresEvenForTheCorrectPassword()
    {
        var email = TestSession.NewEmail();
        await api.NewSession().RegisteredAsync(email);
        var attacker = api.NewSession();

        for (var i = 0; i < 5; i++) await attacker.LoginAsync(email, $"wrong-guess-{i}");

        var locked = await api.NewSession().LoginAsync(email);
        Assert.Equal(HttpStatusCode.TooManyRequests, locked.StatusCode);
        Assert.True(locked.Headers.RetryAfter is not null);

        api.Clock.Advance(TimeSpan.FromMinutes(16));
        Assert.Equal(HttpStatusCode.OK, (await api.NewSession().LoginAsync(email)).StatusCode);
    }

    [Fact]
    public async Task ProtectedEndpointsRequireASession()
    {
        var anonymous = api.NewSession();
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/auth/me")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/history")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/me/settings")).StatusCode);
    }

    [Fact]
    public async Task AccessTokenWorksAsABearerTokenAndNeedsNoCsrfToken()
    {
        var session = await api.NewSession().RegisteredAsync();
        var token = session.Cookie("tg_access")!;

        // An API client with no cookies at all: no ambient credentials, so nothing to forge.
        var client = api.NewSession();
        var response = await client.SendAsync(HttpMethod.Post, "/api/analyses", new { contentType = "sms", text = "hello" }, csrf: false,
            configure: r => r.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task ExpiredAccessTokensAreRejectedAndRefreshRestoresTheSession()
    {
        var session = await api.NewSession().RegisteredAsync();
        api.Clock.Advance(TimeSpan.FromMinutes(16));

        Assert.Equal(HttpStatusCode.Unauthorized, (await session.GetAsync("/api/auth/me")).StatusCode);

        var refresh = await session.PostAsync("/api/auth/refresh");
        Assert.Equal(HttpStatusCode.OK, refresh.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await session.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task RefreshRotatesTheTokenAndKeepsTheSessionAlive()
    {
        var session = await api.NewSession().RegisteredAsync();
        var first = session.Cookie("tg_refresh");

        api.Clock.Advance(TimeSpan.FromMinutes(20));
        Assert.Equal(HttpStatusCode.OK, (await session.PostAsync("/api/auth/refresh")).StatusCode);

        Assert.NotEqual(first, session.Cookie("tg_refresh"));
        Assert.Equal(HttpStatusCode.OK, (await session.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task ReplayingARotatedRefreshTokenRevokesTheWholeSession()
    {
        var session = await api.NewSession().RegisteredAsync();
        var stolen = session.Cookie("tg_refresh")!;

        api.Clock.Advance(TimeSpan.FromMinutes(1));
        Assert.Equal(HttpStatusCode.OK, (await session.PostAsync("/api/auth/refresh")).StatusCode);
        var legitimate = session.Cookie("tg_refresh")!;

        // Much later, an attacker presents the token that was already rotated away.
        api.Clock.Advance(TimeSpan.FromMinutes(5));
        var attacker = api.NewSession();
        attacker.SetCookie("tg_refresh", stolen);
        attacker.SetCookie("tg_csrf", "x");
        var replay = await attacker.PostAsync("/api/auth/refresh");
        Assert.Equal(HttpStatusCode.Unauthorized, replay.StatusCode);
        Assert.Equal("session_revoked", (await TestSession.JsonAsync(replay)).GetProperty("code").GetString());

        // The reuse ends every session in the family, including the legitimate user's newest token.
        var victim = api.NewSession();
        victim.SetCookie("tg_refresh", legitimate);
        victim.SetCookie("tg_csrf", "x");
        Assert.Equal(HttpStatusCode.Unauthorized, (await victim.PostAsync("/api/auth/refresh")).StatusCode);
    }

    [Fact]
    public async Task ASecondTabRefreshingMomentsLaterIsNotTreatedAsTheft()
    {
        var session = await api.NewSession().RegisteredAsync();
        var oldToken = session.Cookie("tg_refresh")!;
        Assert.Equal(HttpStatusCode.OK, (await session.PostAsync("/api/auth/refresh")).StatusCode);
        var newToken = session.Cookie("tg_refresh")!;

        api.Clock.Advance(TimeSpan.FromSeconds(2));
        var secondTab = api.NewSession();
        secondTab.SetCookie("tg_refresh", oldToken);
        secondTab.SetCookie("tg_csrf", "x");
        var response = await secondTab.PostAsync("/api/auth/refresh");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("refresh_in_progress", (await TestSession.JsonAsync(response)).GetProperty("code").GetString());

        // The session that just rotated is untouched.
        session.SetCookie("tg_refresh", newToken);
        Assert.Equal(HttpStatusCode.OK, (await session.PostAsync("/api/auth/refresh")).StatusCode);
    }

    [Fact]
    public async Task OnlyOneOfTwoSimultaneousRefreshesCanSucceed()
    {
        var session = await api.NewSession().RegisteredAsync();
        var token = session.Cookie("tg_refresh")!;

        async Task<HttpStatusCode> Refresh()
        {
            var tab = api.NewSession();
            tab.SetCookie("tg_refresh", token);
            tab.SetCookie("tg_csrf", "x");
            return (await tab.PostAsync("/api/auth/refresh")).StatusCode;
        }

        var results = await Task.WhenAll(Refresh(), Refresh(), Refresh());
        Assert.Equal(1, results.Count(r => r == HttpStatusCode.OK));
        Assert.All(results.Where(r => r != HttpStatusCode.OK), r => Assert.Equal(HttpStatusCode.Conflict, r));
    }

    [Fact]
    public async Task LogoutEndsTheSessionOnTheServer()
    {
        var session = await api.NewSession().RegisteredAsync();
        var refreshToken = session.Cookie("tg_refresh")!;

        Assert.Equal(HttpStatusCode.NoContent, (await session.PostAsync("/api/auth/logout")).StatusCode);
        Assert.Null(session.Cookie("tg_access"));
        Assert.Null(session.Cookie("tg_refresh"));

        // Even a copy of the old refresh cookie is useless now.
        var thief = api.NewSession();
        thief.SetCookie("tg_refresh", refreshToken);
        thief.SetCookie("tg_csrf", "x");
        Assert.Equal(HttpStatusCode.Unauthorized, (await thief.PostAsync("/api/auth/refresh")).StatusCode);
    }

    [Fact]
    public async Task RefreshWithoutACookieIsRejected()
    {
        var session = api.NewSession();
        await session.GetAsync("/api/auth/csrf");
        var response = await session.PostAsync("/api/auth/refresh");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("no_session", JsonSerializer.Deserialize<JsonElement>(await response.Content.ReadAsStringAsync()).GetProperty("code").GetString());
    }

    [Fact]
    public async Task SessionProbeAnswersOkForAnonymousVisitors()
    {
        var body = await TestSession.JsonAsync(await api.NewSession().GetAsync("/api/auth/session"));
        Assert.Equal(JsonValueKind.Null, body.GetProperty("user").ValueKind);
        Assert.False(body.GetProperty("canRefresh").GetBoolean());
    }

    [Fact]
    public async Task SessionProbeReturnsTheUserAndTellsWhenAnExpiredSessionCanBeRenewed()
    {
        var email = TestSession.NewEmail();
        var session = await api.NewSession().RegisteredAsync(email);

        var signedIn = await TestSession.JsonAsync(await session.GetAsync("/api/auth/session"));
        Assert.Equal(email, signedIn.GetProperty("user").GetProperty("email").GetString());
        Assert.False(signedIn.GetProperty("canRefresh").GetBoolean());

        api.Clock.Advance(TimeSpan.FromMinutes(20));
        var expired = await TestSession.JsonAsync(await session.GetAsync("/api/auth/session"));
        Assert.Equal(JsonValueKind.Null, expired.GetProperty("user").ValueKind);
        Assert.True(expired.GetProperty("canRefresh").GetBoolean());
    }
}
