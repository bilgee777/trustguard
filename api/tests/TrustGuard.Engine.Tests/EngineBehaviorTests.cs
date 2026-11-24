using System.Globalization;
using TrustGuard.Engine;

namespace TrustGuard.Engine.Tests;

public class EngineBehaviorTests
{
    private static AnalysisResult Run(string text, ContentType type = ContentType.Sms) => RiskEngine.Analyze(new AnalysisInput(type, text));

    private static string[] Rules(string text, ContentType type = ContentType.Sms) => Run(text, type).Findings.Select(f => f.RuleId).ToArray();

    [Fact]
    public void OrdinaryMessagesScoreLow()
    {
        var result = Run("Running 10 minutes late, order me a coffee please. See you at the station.");
        Assert.Equal(0, result.Score);
        Assert.Equal(RiskLevel.Low, result.Level);
        Assert.Contains("not a guarantee", result.Recommendations[0].Text, StringComparison.Ordinal);
    }

    [Fact]
    public void RepeatingAPhraseDoesNotInflateTheScore() =>
        Assert.Equal(Run("URGENT: reply now.").Score, Run("URGENT URGENT URGENT URGENT: reply now.").Score);

    [Fact]
    public void AiSummaryIsNeverFabricated() => Assert.Null(Run("test message").AiSummary);

    [Theory]
    [InlineData(new double[] { }, 0)]
    [InlineData(new[] { 0.5 }, 50)]
    [InlineData(new[] { 0.5, 0.5 }, 75)]
    public void CombinesWeightsWithNoisyOr(double[] weights, int expected) => Assert.Equal(expected, Scoring.CombineWeights(weights));

    [Fact]
    public void ScoreNeverDecreasesAsEvidenceIsAdded()
    {
        var weights = new List<double>();
        var previous = 0;
        foreach (var weight in new[] { 0.2, 0.3, 0.9, 0.9, 0.9, 0.9 })
        {
            weights.Add(weight);
            var score = Scoring.CombineWeights(weights);
            Assert.InRange(score, previous, 100);
            previous = score;
        }
    }

    [Theory]
    [InlineData(0, RiskLevel.Low)]
    [InlineData(24, RiskLevel.Low)]
    [InlineData(25, RiskLevel.Moderate)]
    [InlineData(49, RiskLevel.Moderate)]
    [InlineData(50, RiskLevel.High)]
    [InlineData(74, RiskLevel.High)]
    [InlineData(75, RiskLevel.Critical)]
    [InlineData(100, RiskLevel.Critical)]
    public void MapsScoresToLevels(int score, RiskLevel level) => Assert.Equal(level, Scoring.LevelForScore(score));

    [Fact]
    public void UsesHalfUpRoundingLikeJavaScript()
    {
        Assert.Equal(3, JsText.Round(2.5));
        Assert.Equal(1, JsText.Round(0.5));
        Assert.Equal(2, JsText.Round(1.5));
    }

    [Theory]
    [InlineData("https://paypa1.com/login", "Look-alike of PayPal")]
    [InlineData("https://rnicrosoft.com", "Look-alike of Microsoft")]
    [InlineData("https://netfilx.com", "Misspelling of Netflix")]
    [InlineData("https://paypal-secure-login.com", "Uses PayPal's name in a different domain")]
    [InlineData("https://paypal.com.account-check.net", "PayPal name placed in a subdomain")]
    public void FlagsBrandLookalikes(string url, string title) =>
        Assert.Equal(title, UrlInspector.Inspect(url).Findings.First(f => f.RuleId == "url.brand-lookalike").Title);

    [Theory]
    [InlineData("https://purchase.com")]
    [InlineData("https://pineapple.com")]
    [InlineData("https://github.com")]
    [InlineData("https://chose.org")]
    public void DoesNotFlagInnocentDomains(string url) =>
        Assert.DoesNotContain(UrlInspector.Inspect(url).Findings, f => f.RuleId == "url.brand-lookalike");

    [Fact]
    public void ReportsPunycodeOwnersInAsciiForm()
    {
        var report = UrlInspector.Inspect("https://xn--pypal-4ve.com");
        Assert.Equal("p\u0430ypal.com", report.Parts!.UnicodeHost);
        Assert.Equal("xn--pypal-4ve.com", report.Parts.RegistrableDomain);
        Assert.Equal(UrlCheckStatus.Fail, report.Checks.First(c => c.Id == "punycode").Status);
    }

    [Fact]
    public void RevealsTheRealHostBehindAnAtSign()
    {
        var report = UrlInspector.Inspect("https://www.paypal.com@evil.example/login");
        Assert.Equal("evil.example", report.Parts!.Host);
        Assert.Contains("url.userinfo", report.Findings.Select(f => f.RuleId));
    }

    [Fact]
    public void FlagsPrivateAndObfuscatedAddresses()
    {
        string? Title(string url) => UrlInspector.Inspect(url).Findings.FirstOrDefault(f => f.RuleId == "url.ip-host")?.Title;
        Assert.Equal("Link to a private network address", Title("http://192.168.1.1/admin"));
        Assert.Equal("Disguised IP address", Title("http://0x08080808/"));
        Assert.Equal("Raw IP address instead of a domain", Title("http://8.8.8.8/"));
        Assert.Equal("127.0.0.1", UrlInspector.Inspect("http://0x7f000001/").Parts!.Host);
    }

    [Fact]
    public void DoesNotClaimHttpWhenNoSchemeWasGiven() =>
        Assert.Equal(UrlCheckStatus.Info, UrlInspector.Inspect("example.com").Checks.First(c => c.Id == "scheme").Status);

    [Theory]
    [InlineData("")]
    [InlineData("https://exa mple.com")]
    [InlineData("https://")]
    public void RejectsMalformedInputWithoutThrowing(string url) => Assert.False(UrlInspector.Inspect(url).Valid);

    [Theory]
    [InlineData("https://100%@evil.example/")]
    [InlineData("https://%E0%A4%A@evil.example/")]
    [InlineData("http://%zz:%zz@a.com")]
    public void SurvivesMalformedPercentEncodingInUserInfo(string url) =>
        Assert.Contains("url.userinfo", UrlInspector.Inspect(url).Findings.Select(f => f.RuleId));

    [Fact]
    public void ExtractsLinksWithCorrectOffsets()
    {
        const string text = "Go to https://a.example/x, or www.b.com, or bit.ly/abc.";
        var urls = UrlInspector.ExtractUrls(text);
        Assert.Equal(["https://a.example/x", "www.b.com", "bit.ly/abc"], urls.Select(u => u.Value));
        Assert.All(urls, u => Assert.Equal(u.Value, text[u.Start..u.End]));
    }

    [Fact]
    public void IgnoresEmailAddressesWhenExtractingLinks() => Assert.Empty(UrlInspector.ExtractUrls("Write to support@example.com"));

    [Fact]
    public void DefangsLinks() => Assert.Equal("hxxps://evil[.]example[.]com/a.b", UrlInspector.Defang("https://evil.example.com/a.b"));

    [Fact]
    public void FlagsLookalikeSenderDomains()
    {
        var result = Run("From: PayPal <service@paypa1-support.com>\nHello", ContentType.Email);
        var finding = Assert.Single(result.Findings, f => f.RuleId == "sender.lookalike");
        Assert.Contains("PayPal", finding.Title, StringComparison.Ordinal);
        Assert.Equal("paypa1-support.com", result.Text[finding.Spans[0].Start..finding.Spans[0].End]);
        Assert.DoesNotContain("sender.lookalike", Rules("From: Priya <priya@acme-studio.com>", ContentType.Email));
    }

    [Fact]
    public void ReportsImpersonationOnlyForUnofficialLinks()
    {
        Assert.Contains("impersonation.brand", Rules("Netflix: your payment failed. Update billing at https://netflix-billing-help.com"));
        Assert.DoesNotContain("impersonation.brand", Rules("Your Netflix plan renews on 12 May. Manage it at https://www.netflix.com/account", ContentType.Email));
    }

    [Fact]
    public void LimitsPrimaryActionsToThree()
    {
        var result = Run("URGENT: your PayPal account will be suspended. Verify your account and send the OTP code we sent you: http://paypa1-login.top");
        Assert.True(result.Recommendations.Count(r => r.Priority == RecommendationPriority.Primary) <= 3);
    }

    [Fact]
    public void GivesLowConfidenceForVeryShortText() => Assert.Equal(ConfidenceLevel.Low, Run("ok").Confidence.Level);

    [Fact]
    public void RuleDataIsComplete()
    {
        Assert.Equal(17, EngineData.Rules.Count);
        Assert.All(EngineData.Rules, r => Assert.InRange(r.Weight, 0.0001, 0.9999));
        Assert.True(EngineData.Brands.Count >= 20);
        Assert.Contains("top", EngineData.HighAbuseTlds);
    }

    [Fact]
    public void RoundTripsPunycode()
    {
        var idn = new IdnMapping();
        foreach (var label in new[] { "m\u00fcnchen", "p\u0430ypal", "\u4e2d\u6587", "caf\u00e9", "\U0001F4A9", "fa\u00df", "b\u00fccher-\u00fcber" })
        {
            var encoded = Punycode.EncodeLabel(label);
            Assert.Equal(idn.GetAscii(label)["xn--".Length..], encoded);
            Assert.Equal(label, Punycode.DecodeLabel(encoded!));
        }
    }

    [Theory]
    [InlineData("b922i")]
    [InlineData("gb75y")]
    [InlineData("ox27u")]
    [InlineData("99999999")]
    public void RejectsPunycodeThatDecodesBeyondUnicode(string label) => Assert.Null(Punycode.DecodeLabel(label));
}
