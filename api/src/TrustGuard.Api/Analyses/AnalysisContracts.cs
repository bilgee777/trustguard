using System.ComponentModel.DataAnnotations;
using System.Text.Json;
using TrustGuard.Engine;

namespace TrustGuard.Api.Analyses;

public sealed class AnalyzeRequest
{
    [Required]
    public ContentType? ContentType { get; init; }

    [Required, StringLength(RiskEngine.MaxInputLength, MinimumLength = 1)]
    public string Text { get; init; } = "";

    /// <summary>Set to false to skip saving even when history is turned on for the account.</summary>
    public bool? Save { get; init; }
}

public sealed record AnalyzeResponse(AnalysisResult Result, bool Saved, Guid? HistoryId);

public sealed class InspectUrlRequest
{
    [Required, StringLength(2048, MinimumLength = 1)]
    public string Url { get; init; } = "";
}

public sealed record HistoryItemDto(
    Guid Id,
    DateTimeOffset CreatedAt,
    DateTimeOffset ExpiresAt,
    ContentType ContentType,
    int Score,
    RiskLevel Level,
    ConfidenceLevel ConfidenceLevel,
    int ConfidenceValue,
    string[] Categories,
    string[] FindingTitles,
    bool HasDetails);

public sealed record HistoryPage(IReadOnlyList<HistoryItemDto> Items, int Total, int Page, int PageSize);

/// <summary>The analysis is returned as raw JSON exactly as stored, so the API never reinterprets it.</summary>
public sealed record HistoryDetailDto(HistoryItemDto Item, string? RedactedText, JsonElement? Result);
