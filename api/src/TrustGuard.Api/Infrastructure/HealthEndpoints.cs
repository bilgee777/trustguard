using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace TrustGuard.Api.Infrastructure;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        // Liveness: the process is up. Readiness: it can reach its database. Neither leaks exception details.
        app.MapHealthChecks("/api/health/live", new() { Predicate = _ => false, ResponseWriter = Write });
        app.MapHealthChecks("/api/health/ready", new() { Predicate = check => check.Tags.Contains("ready"), ResponseWriter = Write });
        return app;
    }

    private static Task Write(HttpContext context, HealthReport report) =>
        context.Response.WriteAsJsonAsync(new
        {
            status = report.Status == HealthStatus.Healthy ? "ok" : "degraded",
            checks = report.Entries.Select(e => new { name = e.Key, status = e.Value.Status == HealthStatus.Healthy ? "ok" : "failing" }),
        });
}

public sealed class DatabaseHealthCheck(TrustGuard.Api.Data.AppDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default) =>
        await db.Database.CanConnectAsync(cancellationToken) ? HealthCheckResult.Healthy() : HealthCheckResult.Unhealthy("The database is not reachable.");
}
