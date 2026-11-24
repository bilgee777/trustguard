using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;

namespace TrustGuard.Api.Tests;

[Collection(ApiCollection.Name)]
public class SecurityTests(ApiFixture api)
{
    private static string Code(JsonElement problem) => problem.GetProperty("code").GetString()!;

    [Fact]
    public async Task StateChangingRequestsWithSessionCookiesNeedTheCsrfHeader()
    {
        var session = await api.NewSession().RegisteredAsync();

        var missing = await session.SendAsync(HttpMethod.Post, "/api/analyses", new { contentType = "sms", text = "hi" }, csrf: false);
        Assert.Equal(HttpStatusCode.Forbidden, missing.StatusCode);
        Assert.Equal("csrf_token_invalid", Code(await TestSession.JsonAsync(missing)));

        var wrong = await session.SendAsync(HttpMethod.Post, "/api/analyses", new { contentType = "sms", text = "hi" }, csrf: false,
            configure: r => r.Headers.Add("X-CSRF-Token", "not-the-token"));
        Assert.Equal(HttpStatusCode.Forbidden, wrong.StatusCode);

        var correct = await session.AnalyzeAsync("hi");
        Assert.Equal(HttpStatusCode.OK, correct.StatusCode);
    }

    [Fact]
    public async Task SessionCookiesAloneCannotLogOutOrRefreshAnotherSiteForgery()
    {
        var session = await api.NewSession().RegisteredAsync();
        foreach (var url in new[] { "/api/auth/logout", "/api/auth/refresh" })
        {
            var forged = await session.SendAsync(HttpMethod.Post, url, csrf: false);
            Assert.Equal(HttpStatusCode.Forbidden, forged.StatusCode);
        }
        // Nothing was revoked by the blocked attempts.
        Assert.Equal(HttpStatusCode.OK, (await session.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task ReadOnlyRequestsNeverNeedACsrfToken() =>
        Assert.Equal(HttpStatusCode.OK, (await (await api.NewSession().RegisteredAsync()).SendAsync(HttpMethod.Get, "/api/auth/me", csrf: false)).StatusCode);

    [Theory]
    [InlineData("http://evil.example", false)]
    [InlineData("https://localhost", false)]
    [InlineData("http://localhost", true)]
    [InlineData("http://allowed.example", true)]
    public async Task OriginHeaderMustBeSameSiteOrAllowListed(string origin, bool allowed)
    {
        var session = await api.NewSession().RegisteredAsync();
        var response = await session.SendAsync(HttpMethod.Post, "/api/analyses", new { contentType = "sms", text = "hi" }, configure: r => r.Headers.Add("Origin", origin));

        if (allowed) Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        else
        {
            Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
            Assert.Equal("origin_not_allowed", Code(await TestSession.JsonAsync(response)));
        }
    }

    [Fact]
    public async Task LoginIsAlsoProtectedAgainstForeignOrigins()
    {
        var session = api.NewSession();
        await session.GetAsync("/api/auth/csrf");
        var response = await session.SendAsync(HttpMethod.Post, "/api/auth/login", new { email = "a@example.com", password = "x" }, configure: r => r.Headers.Add("Origin", "http://evil.example"));
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task ResponsesCarryDefensiveHeaders()
    {
        var response = await api.NewSession().GetAsync("/api/auth/csrf");
        Assert.Equal("nosniff", response.Headers.GetValues("X-Content-Type-Options").Single());
        Assert.Equal("no-referrer", response.Headers.GetValues("Referrer-Policy").Single());
        Assert.Contains("frame-ancestors 'none'", response.Headers.GetValues("Content-Security-Policy").Single(), StringComparison.Ordinal);
        Assert.Equal("no-store", response.Headers.GetValues("Cache-Control").Single());
    }

    [Fact]
    public async Task AuthEndpointsAreRateLimitedPerClient()
    {
        await using var limited = api.WithWebHostBuilder(b => b.UseSetting("Security:AuthAttemptsPerMinute", "3"));
        var session = api.NewSession(limited);
        await session.GetAsync("/api/auth/csrf");

        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 5; i++) statuses.Add((await session.PostAsync("/api/auth/login", new { email = TestSession.NewEmail(), password = "whatever-password" })).StatusCode);

        Assert.Equal(3, statuses.Count(s => s == HttpStatusCode.Unauthorized));
        Assert.Equal(2, statuses.Count(s => s == HttpStatusCode.TooManyRequests));

        var blocked = await session.PostAsync("/api/auth/login", new { email = "a@example.com", password = "whatever-password" });
        Assert.True(blocked.Headers.RetryAfter is not null);
        Assert.Equal("rate_limited", Code(await TestSession.JsonAsync(blocked)));
    }

    [Fact]
    public async Task AnonymousAnalysisIsRateLimited()
    {
        await using var limited = api.WithWebHostBuilder(b => b.UseSetting("Security:AnonymousAnalysesPerMinute", "2"));
        var session = api.NewSession(limited);
        var statuses = new List<HttpStatusCode>();
        for (var i = 0; i < 4; i++) statuses.Add((await session.AnalyzeAsync("hello there")).StatusCode);
        Assert.Equal(2, statuses.Count(s => s == HttpStatusCode.OK));
        Assert.Equal(2, statuses.Count(s => s == HttpStatusCode.TooManyRequests));
    }

    [Fact]
    public async Task MalformedRequestsAreClientErrorsNotServerErrors()
    {
        var session = api.NewSession();
        var badJson = await session.SendAsync(HttpMethod.Post, "/api/analyses", csrf: false, configure: r => r.Content = new StringContent("{\"contentType\": ", System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, badJson.StatusCode);
        Assert.Equal("invalid_request", Code(await TestSession.JsonAsync(badJson)));

        var unknown = await session.GetAsync("/api/does-not-exist");
        Assert.Equal(HttpStatusCode.NotFound, unknown.StatusCode);
        Assert.Equal("application/problem+json", unknown.Content.Headers.ContentType!.MediaType);
    }

    [Fact]
    public async Task ErrorResponsesNeverLeakInternals()
    {
        var response = await api.NewSession().SendAsync(HttpMethod.Post, "/api/analyses", csrf: false, configure: r => r.Content = new StringContent("{", System.Text.Encoding.UTF8, "application/json"));
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("   at ", body, StringComparison.Ordinal);
        Assert.DoesNotContain("Exception", body, StringComparison.Ordinal);
        Assert.Contains("traceId", body, StringComparison.Ordinal);
    }

    [Fact]
    public async Task HealthEndpointsReportLivenessAndDatabaseReadiness()
    {
        var session = api.NewSession();
        var live = await session.GetAsync("/api/health/live");
        Assert.Equal(HttpStatusCode.OK, live.StatusCode);

        var ready = await session.GetAsync("/api/health/ready");
        Assert.Equal(HttpStatusCode.OK, ready.StatusCode);
        var body = await TestSession.JsonAsync(ready);
        Assert.Equal("ok", body.GetProperty("status").GetString());
        Assert.Equal("database", body.GetProperty("checks")[0].GetProperty("name").GetString());
    }

    [Fact]
    public async Task OpenApiDocumentDescribesTheApi()
    {
        var response = await api.NewSession().GetAsync("/api/openapi.json");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var paths = (await TestSession.JsonAsync(response)).GetProperty("paths");
        foreach (var path in new[] { "/api/analyses", "/api/auth/login", "/api/history", "/api/me/settings", "/api/url-inspections" })
        {
            Assert.True(paths.TryGetProperty(path, out _), $"{path} is missing from the OpenAPI document");
        }
    }
}
