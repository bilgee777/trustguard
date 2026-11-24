using System.Net;
using System.Text.Json;
using TrustGuard.Engine;

namespace TrustGuard.Api.Tests;

[Collection(ApiCollection.Name)]
public class AnalysisTests(ApiFixture api)
{
    private const string Scam = "URGENT: verify your account at http://paypa1-login.top now";

    [Fact]
    public async Task AnonymousCallersGetTheFullAnalysisAndNothingIsStored()
    {
        var before = await api.WithDbAsync(db => Task.FromResult(db.Analyses.Count()));
        var response = await api.NewSession().AnalyzeAsync(Scam);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await TestSession.JsonAsync(response);
        Assert.False(body.GetProperty("saved").GetBoolean());
        Assert.True(body.GetProperty("result").GetProperty("score").GetInt32() >= 75);
        Assert.Equal(JsonValueKind.Null, body.GetProperty("result").GetProperty("aiSummary").ValueKind);

        Assert.Equal(before, await api.WithDbAsync(db => Task.FromResult(db.Analyses.Count())));
    }

    [Fact]
    public async Task ApiResultEqualsTheEngineResultExactly()
    {
        var expected = RiskEngine.Analyze(new AnalysisInput(ContentType.Sms, Scam));
        var actual = (await TestSession.JsonAsync(await api.NewSession().AnalyzeAsync(Scam))).GetProperty("result");

        Assert.Equal(expected.Score, actual.GetProperty("score").GetInt32());
        Assert.Equal("critical", actual.GetProperty("level").GetString());
        Assert.Equal(expected.Findings.Select(f => f.RuleId), actual.GetProperty("findings").EnumerateArray().Select(f => f.GetProperty("ruleId").GetString()));
        Assert.Equal(expected.Findings.Count, actual.GetProperty("contributions").GetArrayLength());
    }

    [Fact]
    public async Task UsesTheSameJsonContractAsTheWebApp()
    {
        var result = (await TestSession.JsonAsync(await api.NewSession().AnalyzeAsync("Please apply: no experience needed, earn $300 per day", "job_offer"))).GetProperty("result");
        Assert.Equal("job_offer", result.GetProperty("contentType").GetString());
        Assert.Equal("unrealistic_earnings", result.GetProperty("findings").EnumerateArray().Select(f => f.GetProperty("category").GetString()).First(c => c == "unrealistic_earnings"));
        Assert.True(result.TryGetProperty("highlights", out _));
        Assert.True(result.TryGetProperty("recommendations", out _));
    }

    [Theory]
    [InlineData("", "sms")]
    [InlineData("   ", "sms")]
    public async Task RejectsEmptyText(string text, string type)
    {
        var response = await api.NewSession().AnalyzeAsync(text, type);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.True((await TestSession.JsonAsync(response)).TryGetProperty("errors", out _));
    }

    [Fact]
    public async Task RejectsTextBeyondTheLimit() =>
        Assert.Equal(HttpStatusCode.BadRequest, (await api.NewSession().AnalyzeAsync(new string('a', RiskEngine.MaxInputLength + 1))).StatusCode);

    [Fact]
    public async Task AcceptsTextExactlyAtTheLimit() =>
        Assert.Equal(HttpStatusCode.OK, (await api.NewSession().AnalyzeAsync(new string('a', RiskEngine.MaxInputLength))).StatusCode);

    [Fact]
    public async Task RejectsUnknownContentTypesAndMissingFields()
    {
        var session = api.NewSession();
        Assert.Equal(HttpStatusCode.BadRequest, (await session.PostAsync("/api/analyses", new { contentType = "fax", text = "hi" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await session.PostAsync("/api/analyses", new { text = "hi" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await session.PostAsync("/api/analyses", new { contentType = "sms" })).StatusCode);
    }

    [Fact]
    public async Task UrlContentMustBeASingleLink()
    {
        var response = await api.NewSession().AnalyzeAsync("not a link at all", "url");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task HostileTextIsAnalyzedNotExecuted()
    {
        var payload = "<script>alert(1)</script>' OR 1=1 --; DROP TABLE users; \u0000 URGENT verify your account";
        var response = await api.NewSession().AnalyzeAsync(payload);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(await api.WithDbAsync(db => Task.FromResult(db.Users.Any() || !db.Users.Any())), "the database is still queryable");
    }

    [Fact]
    public async Task UrlInspectionReturnsAStructuralReport()
    {
        var response = await api.NewSession().PostAsync("/api/url-inspections", new { url = "https://www.paypal.com@evil.example/login" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var report = await TestSession.JsonAsync(response);
        Assert.Equal("evil.example", report.GetProperty("parts").GetProperty("host").GetString());
        Assert.Contains("hxxps://", report.GetProperty("defanged").GetString(), StringComparison.Ordinal);
    }

    [Fact]
    public async Task UrlInspectionReportsMalformedInputAsInvalidNotAnError()
    {
        var report = await TestSession.JsonAsync(await api.NewSession().PostAsync("/api/url-inspections", new { url = "https://exa mple.com" }));
        Assert.False(report.GetProperty("valid").GetBoolean());
        Assert.Equal(JsonValueKind.Null, report.GetProperty("parts").ValueKind);
    }

    [Fact]
    public async Task UrlInspectionRejectsOversizedInput() =>
        Assert.Equal(HttpStatusCode.BadRequest, (await api.NewSession().PostAsync("/api/url-inspections", new { url = new string('a', 2049) })).StatusCode);
}
