using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TrustGuard.Api.Data;
using TrustGuard.Engine;

namespace TrustGuard.Api.Analyses;

public sealed class HistoryRecorder(AppDbContext db, TimeProvider clock)
{
    /// <summary>
    /// Saves an analysis according to the account's history mode and returns the new id, or null when
    /// nothing was saved. Off (the default) stores nothing. Summary stores scores and indicator names, never
    /// text. RedactedText additionally stores a copy of the message with personal data masked, together
    /// with the analysis of that copy, so what history shows is always consistent with what is stored.
    /// </summary>
    public async Task<Guid?> RecordAsync(Guid userId, AnalyzeRequest request, AnalysisResult original, CancellationToken ct)
    {
        var settings = await db.Users.Where(u => u.Id == userId)
            .Select(u => new { u.HistoryMode, u.RetentionDays })
            .SingleOrDefaultAsync(ct);
        if (settings is null || settings.HistoryMode == HistoryMode.Off) return null;

        var id = Guid.CreateVersion7();
        var now = clock.GetUtcNow();
        var stored = original;
        string? redactedText = null;
        string? resultJson = null;

        if (settings.HistoryMode == HistoryMode.RedactedText)
        {
            redactedText = Redactor.Redact(original.Text);
            stored = RiskEngine.Analyze(new AnalysisInput(request.ContentType!.Value, redactedText), new AnalyzeOptions { Id = id.ToString(), Now = now });
            resultJson = JsonSerializer.Serialize(stored, EngineJson.Options);
        }

        db.Analyses.Add(new AnalysisRecord
        {
            Id = id,
            UserId = userId,
            CreatedAt = now,
            ExpiresAt = now.AddDays(settings.RetentionDays),
            ContentType = stored.ContentType,
            Score = stored.Score,
            Level = stored.Level,
            ConfidenceLevel = stored.Confidence.Level,
            ConfidenceValue = stored.Confidence.Value,
            EngineVersion = stored.EngineVersion,
            Categories = stored.Findings.Select(f => EngineJson.EnumName(f.Category)).Distinct().ToArray(),
            RuleIds = stored.Findings.Select(f => f.RuleId).ToArray(),
            FindingTitles = string.Join('\n', stored.Findings.Select(f => f.Title)),
            RedactedText = redactedText,
            ResultJson = resultJson,
        });
        await db.SaveChangesAsync(ct);
        return id;
    }
}
