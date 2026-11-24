using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using TrustGuard.Api.Analyses;
using TrustGuard.Api.Auth;
using TrustGuard.Api.Data;

namespace TrustGuard.Api.Settings;

public sealed class UpdateSettingsRequest
{
    [Required]
    public HistoryMode? HistoryMode { get; init; }

    [Required]
    public int? RetentionDays { get; init; }
}

public sealed class DeleteAccountRequest
{
    [Required, StringLength(PasswordPolicy.MaxLength)]
    public string Password { get; init; } = "";
}

public static class SettingsEndpoints
{
    public static readonly int[] AllowedRetentionDays = [7, 30, 90, 365];

    public static IEndpointRouteBuilder MapSettingsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/me").WithTags("Account").RequireAuthorization();

        group.MapGet("/settings", async (ClaimsPrincipalAccessor user, AppDbContext db, CancellationToken ct) =>
            {
                var settings = await db.Users.AsNoTracking().Where(u => u.Id == user.Id)
                    .Select(u => new SettingsDto(u.HistoryMode, u.RetentionDays)).SingleOrDefaultAsync(ct);
                return settings is null ? Results.Problem(statusCode: 401, title: "Not signed in") : Results.Ok(settings);
            })
            .WithSummary("History and retention preferences.");

        group.MapPut("/settings", async (UpdateSettingsRequest request, ClaimsPrincipalAccessor accessor, AppDbContext db, TimeProvider clock, CancellationToken ct) =>
            {
                if (!AllowedRetentionDays.Contains(request.RetentionDays!.Value))
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["retentionDays"] = [$"Choose one of: {string.Join(", ", AllowedRetentionDays)} days."] });
                }

                var user = await db.Users.SingleOrDefaultAsync(u => u.Id == accessor.Id, ct);
                if (user is null) return Results.Problem(statusCode: 401, title: "Not signed in");

                var mode = request.HistoryMode!.Value;
                var days = request.RetentionDays.Value;
                user.HistoryMode = mode;
                user.RetentionDays = days;

                // New retention applies to what is already saved, so shortening it really shortens it.
                var userId = user.Id;
                await using var transaction = await db.Database.BeginTransactionAsync(ct);
                await db.SaveChangesAsync(ct);
                await db.Analyses.Where(a => a.UserId == userId)
                    .ExecuteUpdateAsync(set => set.SetProperty(a => a.ExpiresAt, a => a.CreatedAt.AddDays(days)), ct);

                // Stepping down from RedactedText must remove the stored text, not just stop saving more of it.
                if (mode != HistoryMode.RedactedText)
                {
                    await db.Analyses.Where(a => a.UserId == userId && (a.RedactedText != null || a.ResultJson != null))
                        .ExecuteUpdateAsync(set => set.SetProperty(a => a.RedactedText, (string?)null).SetProperty(a => a.ResultJson, (string?)null), ct);
                }
                await transaction.CommitAsync(ct);
                return Results.Ok(new SettingsDto(mode, days));
            })
            .WithSummary("Changes the history mode and retention period.");

        group.MapDelete("/", async ([FromBody] DeleteAccountRequest request, ClaimsPrincipalAccessor accessor, AppDbContext db, IPasswordHasher<User> hasher, AuthCookies cookies, HttpContext context, CancellationToken ct) =>
            {
                var user = await db.Users.SingleOrDefaultAsync(u => u.Id == accessor.Id, ct);
                if (user is null) return Results.Problem(statusCode: 401, title: "Not signed in");
                if (hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
                {
                    return Results.Problem(statusCode: 403, title: "Password incorrect", detail: "Enter your current password to delete the account.", extensions: new Dictionary<string, object?> { ["code"] = "invalid_credentials" });
                }

                // Foreign keys cascade: sessions and all saved analyses go with the account.
                db.Users.Remove(user);
                await db.SaveChangesAsync(ct);
                cookies.Clear(context.Response);
                return Results.NoContent();
            })
            .WithSummary("Permanently deletes the account and everything saved under it.");

        return app;
    }
}
