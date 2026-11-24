using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrustGuard.Api.Auth;
using TrustGuard.Api.Data;
using TrustGuard.Engine;

namespace TrustGuard.Api.Analyses;

public sealed class HistoryQuery
{
    public string[]? Level { get; init; }
    public DateOnly? From { get; init; }
    public DateOnly? To { get; init; }
    public string? Q { get; init; }
    public string? Sort { get; init; }
    public int? Page { get; init; }
    public int? PageSize { get; init; }
}

public static class HistoryEndpoints
{
    private const int DefaultPageSize = 20;
    private const int MaxPageSize = 50;

    private static HistoryItemDto ToItem(AnalysisRecord a) => new(
        a.Id, a.CreatedAt, a.ExpiresAt, a.ContentType, a.Score, a.Level, a.ConfidenceLevel, a.ConfidenceValue,
        a.Categories, a.FindingTitles.Length == 0 ? [] : a.FindingTitles.Split('\n'), a.ResultJson is not null);

    /// <summary>Escapes LIKE wildcards so a search for "100%" matches the text, not everything.</summary>
    private static string LikePattern(string term) =>
        "%" + term.Replace("\\", "\\\\", StringComparison.Ordinal).Replace("%", "\\%", StringComparison.Ordinal).Replace("_", "\\_", StringComparison.Ordinal) + "%";

    public static IEndpointRouteBuilder MapHistoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/history").WithTags("History").RequireAuthorization();

        group.MapGet("/", async ([AsParameters] HistoryQuery query, ClaimsPrincipalAccessor user, AppDbContext db, CancellationToken ct) =>
            {
                var errors = new Dictionary<string, string[]>();
                var levels = new List<RiskLevel>();
                foreach (var name in query.Level ?? [])
                {
                    try { levels.Add(EngineJson.ParseEnum<RiskLevel>(name, "level")); }
                    catch (InvalidDataException) { errors["level"] = ["Use low, moderate, high or critical."]; }
                }
                var pageNumber = query.Page ?? 1;
                var pageSize = query.PageSize ?? DefaultPageSize;
                if (pageNumber < 1) errors["page"] = ["Page starts at 1."];
                if (pageSize is < 1 or > MaxPageSize) errors["pageSize"] = [$"Use a page size between 1 and {MaxPageSize}."];
                if (query.From is { } from && query.To is { } to && from > to) errors["from"] = ["The start date must not be after the end date."];
                if (errors.Count > 0) return Results.ValidationProblem(errors);

                var records = db.Analyses.AsNoTracking().Where(a => a.UserId == user.Id);
                if (levels.Count > 0) records = records.Where(a => levels.Contains(a.Level));
                if (query.From is { } start) records = records.Where(a => a.CreatedAt >= new DateTimeOffset(start.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
                if (query.To is { } end) records = records.Where(a => a.CreatedAt < new DateTimeOffset(end.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
                if (!string.IsNullOrWhiteSpace(query.Q))
                {
                    var pattern = LikePattern(query.Q.Trim());
                    records = records.Where(a => EF.Functions.ILike(a.FindingTitles, pattern, "\\") || (a.RedactedText != null && EF.Functions.ILike(a.RedactedText, pattern, "\\")));
                }

                var total = await records.CountAsync(ct);
                var ordered = query.Sort switch
                {
                    "oldest" => records.OrderBy(a => a.CreatedAt),
                    "score" => records.OrderByDescending(a => a.Score).ThenByDescending(a => a.CreatedAt),
                    _ => records.OrderByDescending(a => a.CreatedAt),
                };
                var page = await ordered.Skip((pageNumber - 1) * pageSize).Take(pageSize).ToListAsync(ct);
                return Results.Ok(new HistoryPage(page.Select(ToItem).ToList(), total, pageNumber, pageSize));
            })
            .WithSummary("Lists saved analyses with filtering, search and paging.");

        group.MapGet("/{id:guid}", async (Guid id, ClaimsPrincipalAccessor user, AppDbContext db, CancellationToken ct) =>
            {
                var record = await db.Analyses.AsNoTracking().SingleOrDefaultAsync(a => a.Id == id && a.UserId == user.Id, ct);
                if (record is null) return Results.Problem(statusCode: 404, title: "Not found", detail: "This analysis does not exist or was deleted.");
                JsonElement? result = record.ResultJson is null ? null : JsonDocument.Parse(record.ResultJson).RootElement.Clone();
                return Results.Ok(new HistoryDetailDto(ToItem(record), record.RedactedText, result));
            })
            .WithSummary("One saved analysis, with the redacted text and full result when they were stored.");

        group.MapDelete("/{id:guid}", async (Guid id, ClaimsPrincipalAccessor user, AppDbContext db, CancellationToken ct) =>
            {
                var deleted = await db.Analyses.Where(a => a.Id == id && a.UserId == user.Id).ExecuteDeleteAsync(ct);
                return deleted == 0 ? Results.Problem(statusCode: 404, title: "Not found", detail: "This analysis does not exist or was deleted.") : Results.NoContent();
            })
            .WithSummary("Deletes one saved analysis.");

        group.MapDelete("/", async (ClaimsPrincipalAccessor user, AppDbContext db, CancellationToken ct) =>
            Results.Ok(new { deleted = await db.Analyses.Where(a => a.UserId == user.Id).ExecuteDeleteAsync(ct) }))
            .WithSummary("Deletes the account's entire history.");

        return app;
    }
}

/// <summary>The signed-in user's id, resolved once per request. Endpoints that require authorization can rely on it.</summary>
public sealed class ClaimsPrincipalAccessor(IHttpContextAccessor accessor)
{
    public Guid Id => accessor.HttpContext?.User.GetUserId() ?? throw new InvalidOperationException("No authenticated user.");
}
