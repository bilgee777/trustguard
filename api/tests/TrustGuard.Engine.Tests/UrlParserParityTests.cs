using System.Text.Json;
using TrustGuard.Engine;

namespace TrustGuard.Engine.Tests;

/// <summary>
/// The C# URL parser must see an address exactly as a browser does. Expected values come from Node's
/// WHATWG URL implementation (see web/scripts/gen-url-golden.mjs).
/// </summary>
public class UrlParserParityTests
{
    private static string Describe(ParsedUrl? url) =>
        url is null
            ? "FAIL"
            : $"{{scheme={url.Scheme} user={url.Username} pass={url.Password} host={url.Hostname} port={url.Port} path={url.Pathname} search={url.Search}}}";

    [Fact]
    public void MatchesNodeForEveryCase()
    {
        using var document = JsonDocument.Parse(File.ReadAllText("url-parse-expected.json"));
        var cases = document.RootElement.GetProperty("cases").EnumerateArray().ToList();
        Assert.True(cases.Count > 100, "The golden file should contain the full corpus.");

        var mismatches = new List<string>();
        foreach (var testCase in cases)
        {
            var input = testCase.GetProperty("input").GetString()!;
            var expectedElement = testCase.GetProperty("expected");

            ParsedUrl? expected = null;
            if (expectedElement.ValueKind == JsonValueKind.Object)
            {
                string Get(string name) => expectedElement.GetProperty(name).GetString()!;
                expected = new ParsedUrl(Get("scheme"), Get("username"), Get("password"), Get("hostname"), Get("port"), Get("pathname"), Get("search"));
            }

            var actual = WhatwgUrl.Parse(input);
            if (!Equals(expected, actual))
            {
                mismatches.Add($"  {JsonSerializer.Serialize(input)}\n    node:  {Describe(expected)}\n    c#:    {Describe(actual)}");
            }
        }

        Assert.True(mismatches.Count == 0, $"{mismatches.Count} of {cases.Count} URLs parse differently from Node:\n{string.Join("\n", mismatches)}");
    }
}
