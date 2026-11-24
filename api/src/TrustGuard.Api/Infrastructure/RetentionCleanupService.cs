using Microsoft.EntityFrameworkCore;
using TrustGuard.Api.Data;

namespace TrustGuard.Api.Infrastructure;

/// <summary>Deletes analyses past their retention date and stale session records, so data does not outlive what the user chose.</summary>
public sealed class RetentionCleanupService(IServiceScopeFactory scopes, TimeProvider clock, ILogger<RetentionCleanupService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                await CleanAsync(stoppingToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogError(exception, "Retention cleanup failed; it will retry on the next interval");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    public async Task CleanAsync(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var now = clock.GetUtcNow();

        var analyses = await db.Analyses.Where(a => a.ExpiresAt < now).ExecuteDeleteAsync(ct);
        var sessions = await db.RefreshTokens.Where(t => t.ExpiresAt < now.AddDays(-7) || (t.RevokedAt != null && t.RevokedAt < now.AddDays(-30))).ExecuteDeleteAsync(ct);
        if (analyses + sessions > 0) logger.LogInformation("Retention cleanup removed {Analyses} analyses and {Sessions} session records", analyses, sessions);
    }
}
