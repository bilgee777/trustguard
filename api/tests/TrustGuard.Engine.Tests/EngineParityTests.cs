using System.Text.Json.Nodes;
using TrustGuard.Engine;

namespace TrustGuard.Engine.Tests;

/// <summary>
/// The contract between the two engines. shared/engine/parity-expected.json is produced by the
/// TypeScript engine; the C# engine must reproduce every score, finding, span and explanation exactly.
/// </summary>
public class EngineParityTests
{
    [Fact]
    public void ReproducesTheTypeScriptEngineOnEveryCase()
    {
        var golden = JsonNode.Parse(File.ReadAllText("parity-expected.json"))!;
        var cases = golden["cases"]!.AsArray();
        Assert.True(cases.Count >= 90, "The golden file should contain the full corpus.");

        var failures = new List<string>();
        foreach (var testCase in cases)
        {
            var id = testCase!["id"]!.GetValue<string>();
            var contentType = EngineJson.ParseEnum<ContentType>(testCase["contentType"]!.GetValue<string>(), id);
            var text = testCase["text"]!.GetValue<string>();

            var actual = Projection.Project(RiskEngine.Analyze(new AnalysisInput(contentType, text)));
            var difference = Projection.FirstDifference(testCase["expected"], actual);
            if (difference is not null) failures.Add($"  {id,-28} {difference}");
        }

        Assert.True(failures.Count == 0, $"{failures.Count} of {cases.Count} cases differ from the TypeScript engine:\n{string.Join("\n", failures)}");
    }
}
