using System.Reflection;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace TrustGuard.Engine;

internal sealed record TextRule(
    string Id,
    IndicatorCategory Category,
    string Title,
    string Explanation,
    double Weight,
    IReadOnlyDictionary<ContentType, double> Boost,
    IReadOnlyList<Regex> Patterns);

internal sealed record Brand(string Name, IReadOnlyList<string> Keywords, IReadOnlyList<string> Domains);

internal sealed record BrandToken(Brand Brand, string Token);

/// <summary>
/// Loads the rule data shared with the TypeScript engine (shared/engine/*.json, embedded at build
/// time). JSON carries no types, so everything is validated here and a bad file fails at startup
/// instead of silently mis-scoring messages.
/// </summary>
internal static class EngineData
{
    public static IReadOnlyList<TextRule> Rules { get; } = LoadRules();

    public static IReadOnlyList<Brand> Brands { get; } = LoadBrands();

    public static IReadOnlyList<BrandToken> BrandTokens { get; } = BuildBrandTokens(Brands);

    private static readonly JsonElement Domains = LoadDocument("domains.json");

    public static IReadOnlySet<string> MultiLabelSuffixes { get; } = Strings("multiLabelSuffixes").ToHashSet(StringComparer.Ordinal);

    public static IReadOnlySet<string> UrlShorteners { get; } = Strings("urlShorteners").ToHashSet(StringComparer.Ordinal);

    public static IReadOnlyList<string> HighAbuseTlds { get; } = Strings("highAbuseTlds");

    public static IReadOnlySet<string> HighAbuseTldSet { get; } = HighAbuseTlds.ToHashSet(StringComparer.Ordinal);

    public static IReadOnlyList<string> BareDomainTlds { get; } = Strings("bareDomainTlds");

    private static List<string> Strings(string property) =>
        Domains.GetProperty(property).EnumerateArray().Select(e => e.GetString() ?? throw new InvalidDataException(property)).ToList();

    private static JsonElement LoadDocument(string name)
    {
        var resource = $"TrustGuard.Engine.Data.{name}";
        using var stream = typeof(EngineData).Assembly.GetManifestResourceStream(resource)
            ?? throw new InvalidOperationException($"Embedded engine data \"{resource}\" is missing.");
        return JsonDocument.Parse(stream).RootElement.Clone();
    }

    private static List<TextRule> LoadRules()
    {
        var ids = new HashSet<string>(StringComparer.Ordinal);
        var rules = new List<TextRule>();
        foreach (var raw in LoadDocument("rules.json").GetProperty("rules").EnumerateArray())
        {
            var id = raw.GetProperty("id").GetString()!;
            if (!ids.Add(id)) throw new InvalidDataException($"Duplicate rule id \"{id}\".");

            var weight = raw.GetProperty("weight").GetDouble();
            if (!(weight > 0 && weight < 1)) throw new InvalidDataException($"Rule \"{id}\" weight must be between 0 and 1.");

            var patterns = raw.GetProperty("patterns").EnumerateArray().Select(p => JsRegex.Create(p.GetString()!)).ToList();
            if (patterns.Count == 0) throw new InvalidDataException($"Rule \"{id}\" has no patterns.");

            var boost = new Dictionary<ContentType, double>();
            foreach (var entry in raw.GetProperty("boost").EnumerateObject())
            {
                boost[EngineJson.ParseEnum<ContentType>(entry.Name, $"Rule \"{id}\" boost")] = entry.Value.GetDouble();
            }

            rules.Add(new TextRule(
                id,
                EngineJson.ParseEnum<IndicatorCategory>(raw.GetProperty("category").GetString()!, $"Rule \"{id}\""),
                raw.GetProperty("title").GetString()!,
                raw.GetProperty("explanation").GetString()!,
                weight,
                boost,
                patterns));
        }
        return rules;
    }

    private static List<Brand> LoadBrands() =>
        LoadDocument("brands.json").GetProperty("brands").EnumerateArray()
            .Select(b => new Brand(
                b.GetProperty("name").GetString()!,
                b.GetProperty("keywords").EnumerateArray().Select(k => k.GetString()!).ToList(),
                b.GetProperty("domains").EnumerateArray().Select(d => d.GetString()!).ToList()))
            .ToList();

    /// <summary>Brand tokens for look-alike detection: multi-word keywords collapsed, deduplicated per brand.</summary>
    private static List<BrandToken> BuildBrandTokens(IReadOnlyList<Brand> brands) =>
        brands.SelectMany(brand => brand.Keywords
                .Select(k => new string(k.Where(c => !JsText.IsWhitespace(c)).ToArray()))
                .Distinct(StringComparer.Ordinal)
                .Select(token => new BrandToken(brand, token)))
            .ToList();

    public static bool IsOfficialHost(string host, Brand brand) =>
        brand.Domains.Any(domain => host == domain || host.EndsWith($".{domain}", StringComparison.Ordinal));

    public static Brand? FindOfficialBrand(string host) => Brands.FirstOrDefault(brand => IsOfficialHost(host, brand));
}
