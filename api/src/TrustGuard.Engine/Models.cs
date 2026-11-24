namespace TrustGuard.Engine;

public enum ContentType { Sms, Email, Whatsapp, JobOffer, Url }

public enum IndicatorCategory
{
    Phishing,
    SuspiciousLink,
    SuspiciousDomain,
    Impersonation,
    PersonalInfo,
    AdvanceFee,
    FakeJob,
    UnrealisticEarnings,
    Urgency,
    Obfuscation,
}

public enum RiskLevel { Low, Moderate, High, Critical }

public enum ConfidenceLevel { Low, Medium, High }

public enum UrlCheckStatus { Pass, Info, Warn, Fail }

public enum RecommendationPriority { Primary, Secondary }

public enum AnalysisSource { User, Demo }

public sealed record TextSpan(int Start, int End);

/// <summary>One detected risk indicator. A rule produces at most one finding per analysis.</summary>
public sealed class Finding
{
    public required string Id { get; init; }
    public required string RuleId { get; init; }
    public required IndicatorCategory Category { get; init; }
    public required string Title { get; set; }
    public required string Explanation { get; set; }

    /// <summary>Probability-like strength in (0, 1), combined with other findings via noisy-OR.</summary>
    public required double Weight { get; set; }

    public required List<string> Evidence { get; set; }
    public required List<TextSpan> Spans { get; init; }
}

public sealed record ScoreContribution(string FindingId, int Points);

public sealed record CategoryBreakdown(IndicatorCategory Category, int Points, IReadOnlyList<string> FindingIds);

public sealed record Confidence(ConfidenceLevel Level, int Value, IReadOnlyList<string> Reasons);

public sealed record HighlightSegment(int Start, int End, string Text, IReadOnlyList<string> FindingIds);

public sealed record Recommendation(string Id, string Text, RecommendationPriority Priority);

public sealed record UrlCheck(string Id, string Label, UrlCheckStatus Status, string Detail);

public sealed record UrlParts(
    string? Scheme,
    string? Username,
    string Host,
    string UnicodeHost,
    string RegistrableDomain,
    string Subdomain,
    string? Port,
    string Path,
    string Query);

public sealed record UrlReport(
    string Input,
    string Defanged,
    bool Valid,
    UrlParts? Parts,
    IReadOnlyList<UrlCheck> Checks,
    IReadOnlyList<Finding> Findings,
    int Score,
    RiskLevel Level,
    string? OfficialBrand);

public sealed record AnalysisInput(ContentType ContentType, string Text);

public sealed record AnalyzeOptions
{
    public AnalysisSource Source { get; init; } = AnalysisSource.User;
    public string? DemoScenarioId { get; init; }
    public string? Id { get; init; }
    public DateTimeOffset? Now { get; init; }
}

public sealed record AnalysisResult(
    string Id,
    DateTimeOffset CreatedAt,
    string EngineVersion,
    AnalysisSource Source,
    string? DemoScenarioId,
    ContentType ContentType,
    string Text,
    int Score,
    RiskLevel Level,
    Confidence Confidence,
    IReadOnlyList<Finding> Findings,
    IReadOnlyList<ScoreContribution> Contributions,
    IReadOnlyList<CategoryBreakdown> Categories,
    IReadOnlyList<HighlightSegment> Highlights,
    IReadOnlyList<Recommendation> Recommendations,
    IReadOnlyList<UrlReport> Urls,
    /// <summary>Null until the AI service is connected. Never filled with simulated output.</summary>
    string? AiSummary);
