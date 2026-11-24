using System.Text.Json.Nodes;
using TrustGuard.Engine;

namespace TrustGuard.Engine.Tests;

/// <summary>
/// The same projection of an analysis that web/.../parity.test.ts writes to the golden file. Only
/// stable, behavior-defining fields are compared: ids, timestamps and the raw text are excluded.
/// </summary>
internal static class Projection
{
    private static JsonArray Strings(IEnumerable<string> values) => new(values.Select(v => (JsonNode?)JsonValue.Create(v)).ToArray());

    private static JsonNode? Name<T>(T value) where T : struct, Enum => JsonValue.Create(EngineJson.EnumName(value));

    public static JsonNode Project(AnalysisResult result)
    {
        var points = result.Contributions.ToDictionary(c => c.FindingId, c => c.Points, StringComparer.Ordinal);

        return new JsonObject
        {
            ["score"] = result.Score,
            ["level"] = Name(result.Level),
            ["confidence"] = new JsonObject
            {
                ["level"] = Name(result.Confidence.Level),
                ["value"] = result.Confidence.Value,
                ["reasons"] = Strings(result.Confidence.Reasons),
            },
            ["findings"] = new JsonArray(result.Findings.Select(f => (JsonNode?)new JsonObject
            {
                ["ruleId"] = f.RuleId,
                ["category"] = Name(f.Category),
                ["title"] = f.Title,
                ["explanation"] = f.Explanation,
                ["weight"] = JsText.RoundTo6(f.Weight),
                ["points"] = points[f.Id],
                ["evidence"] = Strings(f.Evidence),
                ["spans"] = new JsonArray(f.Spans.Select(s => (JsonNode?)new JsonArray(s.Start, s.End)).ToArray()),
            }).ToArray()),
            ["urls"] = new JsonArray(result.Urls.Select(u => (JsonNode?)new JsonObject
            {
                ["input"] = u.Input,
                ["defanged"] = u.Defanged,
                ["valid"] = u.Valid,
                ["score"] = u.Score,
                ["level"] = Name(u.Level),
                ["officialBrand"] = u.OfficialBrand,
                ["parts"] = u.Parts is null ? null : new JsonObject
                {
                    ["scheme"] = u.Parts.Scheme,
                    ["username"] = u.Parts.Username,
                    ["host"] = u.Parts.Host,
                    ["unicodeHost"] = u.Parts.UnicodeHost,
                    ["registrableDomain"] = u.Parts.RegistrableDomain,
                    ["subdomain"] = u.Parts.Subdomain,
                    ["port"] = u.Parts.Port,
                    ["path"] = u.Parts.Path,
                    ["query"] = u.Parts.Query,
                },
                ["checks"] = new JsonArray(u.Checks.Select(c => (JsonNode?)new JsonObject
                {
                    ["id"] = c.Id,
                    ["status"] = Name(c.Status),
                    ["detail"] = c.Detail,
                }).ToArray()),
            }).ToArray()),
            ["recommendations"] = new JsonArray(result.Recommendations.Select(r => (JsonNode?)new JsonObject
            {
                ["id"] = r.Id,
                ["priority"] = Name(r.Priority),
            }).ToArray()),
            ["categories"] = new JsonArray(result.Categories.Select(c => (JsonNode?)new JsonObject
            {
                ["category"] = Name(c.Category),
                ["points"] = c.Points,
                ["findingIds"] = Strings(c.FindingIds),
            }).ToArray()),
            ["highlights"] = new JsonArray(result.Highlights.Select(h => (JsonNode?)new JsonObject
            {
                ["start"] = h.Start,
                ["end"] = h.End,
                ["findingIds"] = Strings(h.FindingIds),
            }).ToArray()),
        };
    }

    /// <summary>Path of the first difference between two JSON trees, or null when they are identical.</summary>
    public static string? FirstDifference(JsonNode? expected, JsonNode? actual, string path = "$")
    {
        switch (expected, actual)
        {
            case (null, null):
                return null;
            case (JsonObject e, JsonObject a):
                foreach (var key in e.Select(p => p.Key).Union(a.Select(p => p.Key)))
                {
                    if (!e.ContainsKey(key)) return $"{path}.{key}: unexpected property in C#";
                    if (!a.ContainsKey(key)) return $"{path}.{key}: missing in C#";
                    var inner = FirstDifference(e[key], a[key], $"{path}.{key}");
                    if (inner is not null) return inner;
                }
                return null;
            case (JsonArray e, JsonArray a):
                for (var i = 0; i < Math.Max(e.Count, a.Count); i++)
                {
                    if (i >= e.Count) return $"{path}[{i}]: extra item in C#: {a[i]?.ToJsonString()}";
                    if (i >= a.Count) return $"{path}[{i}]: missing in C#, TypeScript has {e[i]?.ToJsonString()}";
                    var inner = FirstDifference(e[i], a[i], $"{path}[{i}]");
                    if (inner is not null) return inner;
                }
                return null;
            default:
                var left = expected?.ToJsonString(System.Text.Json.JsonSerializerOptions.Default);
                var right = actual?.ToJsonString(System.Text.Json.JsonSerializerOptions.Default);
                return left == right ? null : $"{path}: TypeScript {left}  vs  C# {right}";
        }
    }
}
