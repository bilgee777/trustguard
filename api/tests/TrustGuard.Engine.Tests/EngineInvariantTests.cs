using System.Text.Json;
using TrustGuard.Engine;

namespace TrustGuard.Engine.Tests;

/// <summary>
/// Property-based tests: user text is hostile by definition, so the engine must never throw and
/// every result must satisfy the same invariants, whatever the input.
/// </summary>
public class EngineInvariantTests
{
    private static readonly string[] Fragments =
    [
        "http://", "https://", "www.", ".com", ".top", "xn--", "xn--pypal-4ve", "%", "%zz", "%41", "%E0%A4%A", "@", ":", "[", "]", "::",
        "1.2.3.4", "0x7f000001", "256.1.1.1", "[::1]", " ", "\t", "\n", "\r\n", "\r", "\u200b", "\u00ad", "\ufeff", "\u2028",
        "\U0001F600", "\ud800", "\udc00", "\u0430", "\u03bf", "paypal", "paypa1", "Netflix", "verify your account", "URGENT",
        "$350 per day", "send me the code", "/", "?", "#", "\\", "\u00df", "\u0130", "\u01c5", "a", "9", "-", ".", "bit.ly/x",
        "t.me/x", "gift card", "javascript:", "data:", "file:///", "user:pw@", "100%", "\u00a0", "\u0663", "xn--99999999",
    ];

    private static string RandomText(Random random)
    {
        var parts = random.Next(1, 26);
        return string.Concat(Enumerable.Range(0, parts).Select(_ => Fragments[random.Next(Fragments.Length)]));
    }

    [Fact]
    public void RandomInputNeverThrowsAndKeepsInvariants()
    {
        var random = new Random(20260124);
        var types = Enum.GetValues<ContentType>();

        for (var i = 0; i < 3000; i++)
        {
            var text = RandomText(random);
            var type = types[random.Next(types.Length)];
            var context = $"input #{i} ({type}): {JsonSerializer.Serialize(text)}";

            AnalysisResult result;
            try
            {
                result = RiskEngine.Analyze(new AnalysisInput(type, text));
            }
            catch (Exception exception)
            {
                throw new Xunit.Sdk.XunitException($"Analyze threw {exception.GetType().Name}: {exception.Message}\n{context}");
            }

            Assert.True(result.Score is >= 0 and <= 100, context);
            Assert.True(result.Contributions.Sum(c => c.Points) == result.Score, $"points must sum to the score. {context}");
            Assert.Equal(result.Findings.Count, result.Findings.Select(f => f.Id).Distinct().Count());
            Assert.All(result.Findings, f => Assert.InRange(f.Weight, 0.0001, 0.9999));
            Assert.All(result.Findings, f => Assert.All(f.Spans, s => Assert.True(s.Start >= 0 && s.End <= result.Text.Length && s.Start < s.End, $"span out of range. {context}")));

            Assert.Equal(result.Text, string.Concat(result.Highlights.Select(h => h.Text)));
            for (var h = 1; h < result.Highlights.Count; h++) Assert.Equal(result.Highlights[h - 1].End, result.Highlights[h].Start);

            Assert.Equal(result.Text, System.Text.Encoding.UTF8.GetString(System.Text.Encoding.UTF8.GetBytes(result.Text)));
            var json = JsonSerializer.Serialize(result, EngineJson.Options);
            Assert.NotEmpty(json);
        }
    }

    [Fact]
    public void RandomUrlsNeverThrow()
    {
        var random = new Random(77);
        for (var i = 0; i < 3000; i++)
        {
            var text = RandomText(random);
            var report = UrlInspector.Inspect(text);
            Assert.True(report.Score is >= 0 and <= 100);
            Assert.True(report.Valid || report.Parts is null);
        }
    }

    [Fact]
    public void ReplacesUnpairedSurrogatesSoTextCanAlwaysBeEncoded()
    {
        var result = RiskEngine.Analyze(new AnalysisInput(ContentType.Sms, "a\ud800b URGENT: verify your account"));
        Assert.Equal("a\ufffdb URGENT: verify your account", result.Text);
    }

    [Fact]
    public void NeverLeavesHalfAnEmojiWhenClippingAtTheLengthLimit()
    {
        var result = RiskEngine.Analyze(new AnalysisInput(ContentType.Sms, new string('a', 9999) + "\U0001F600 tail"));
        Assert.Equal(RiskEngine.MaxInputLength, result.Text.Length);
        Assert.EndsWith("\ufffd", result.Text, StringComparison.Ordinal);
    }

    [Fact]
    public void NormalizesCarriageReturns()
    {
        Assert.Equal("a\nb\nc", RiskEngine.Analyze(new AnalysisInput(ContentType.Sms, "a\r\nb\rc")).Text);
    }

    [Fact]
    public void PathologicalInputFinishesQuickly()
    {
        // Bounded quantifiers plus a match timeout: a hostile message cannot pin a CPU core.
        var stopwatch = System.Diagnostics.Stopwatch.StartNew();
        RiskEngine.Analyze(new AnalysisInput(ContentType.Email, string.Concat(Enumerable.Repeat("send code ", 1000))));
        RiskEngine.Analyze(new AnalysisInput(ContentType.Email, new string('a', 10_000)));
        RiskEngine.Analyze(new AnalysisInput(ContentType.Email, string.Concat(Enumerable.Repeat("a.", 5000))));
        Assert.True(stopwatch.Elapsed < TimeSpan.FromSeconds(5), $"took {stopwatch.Elapsed}");
    }
}
