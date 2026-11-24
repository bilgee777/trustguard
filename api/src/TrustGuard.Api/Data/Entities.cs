using TrustGuard.Engine;

namespace TrustGuard.Api.Data;

/// <summary>How much of an analysis is kept. Off is the default: nothing about a message is stored.</summary>
public enum HistoryMode
{
    Off,
    Summary,
    RedactedText,
}

public sealed class User
{
    public required Guid Id { get; init; }
    public required string Email { get; set; }
    public required string DisplayName { get; set; }
    public required string PasswordHash { get; set; }
    public required DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset? LastLoginAt { get; set; }
    public int FailedLoginCount { get; set; }
    public DateTimeOffset? LockedUntil { get; set; }
    public HistoryMode HistoryMode { get; set; } = HistoryMode.Off;
    public int RetentionDays { get; set; } = 30;
}

/// <summary>Only the SHA-256 of a refresh token is stored, so a database leak cannot be replayed as sessions.</summary>
public sealed class RefreshToken
{
    public required Guid Id { get; init; }
    public required Guid UserId { get; init; }
    public required string TokenHash { get; init; }

    /// <summary>All tokens descended from one login. Reusing a rotated token revokes the whole family.</summary>
    public required Guid FamilyId { get; init; }

    public required DateTimeOffset CreatedAt { get; init; }
    public required DateTimeOffset ExpiresAt { get; init; }
    public DateTimeOffset? RevokedAt { get; set; }
    public Guid? ReplacedById { get; set; }

    /// <summary>PostgreSQL's xmin. Two simultaneous refreshes of one token cannot both succeed.</summary>
    public uint Version { get; set; }
}

public sealed class AnalysisRecord
{
    public required Guid Id { get; init; }
    public required Guid UserId { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
    public required DateTimeOffset ExpiresAt { get; set; }
    public required ContentType ContentType { get; init; }
    public required int Score { get; init; }
    public required RiskLevel Level { get; init; }
    public required ConfidenceLevel ConfidenceLevel { get; init; }
    public required int ConfidenceValue { get; init; }
    public required string EngineVersion { get; init; }
    public required string[] Categories { get; init; }
    public required string[] RuleIds { get; init; }

    /// <summary>Titles of the detected indicators, newline separated. Makes history searchable without keeping the message.</summary>
    public required string FindingTitles { get; init; }

    /// <summary>Set only in the RedactedText history mode.</summary>
    public string? RedactedText { get; set; }

    /// <summary>Full engine result for the redacted text (jsonb). Set only in the RedactedText history mode.</summary>
    public string? ResultJson { get; set; }
}
