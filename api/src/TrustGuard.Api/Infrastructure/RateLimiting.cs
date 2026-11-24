using System.Threading.RateLimiting;
using Microsoft.Extensions.Options;
using TrustGuard.Api.Auth;
using TrustGuard.Api.Options;

namespace TrustGuard.Api.Infrastructure;

public static class RateLimiting
{
    private static string ClientKey(HttpContext context) => context.Connection.RemoteIpAddress?.ToString() ?? "unknown";

    public static IServiceCollection AddApiRateLimiting(this IServiceCollection services, SecurityOptions security) =>
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.OnRejected = async (context, token) =>
            {
                // Sliding-window limiters cannot say when a slot frees up; the window length is a safe upper bound.
                var seconds = context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter) ? (int)Math.Ceiling(retryAfter.TotalSeconds) : 60;
                context.HttpContext.Response.Headers.RetryAfter = seconds.ToString(System.Globalization.CultureInfo.InvariantCulture);
                context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
                await context.HttpContext.Response.WriteAsJsonAsync(new Microsoft.AspNetCore.Mvc.ProblemDetails
                {
                    Status = 429,
                    Title = "Too many requests",
                    Detail = "You are sending requests too quickly. Wait a moment and try again.",
                    Extensions = { ["code"] = "rate_limited" },
                }, token);
            };

            // Credential endpoints are the brute-force target, so they get the tightest budget, per client address.
            options.AddPolicy("auth", context => RateLimitPartition.GetSlidingWindowLimiter(ClientKey(context), _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = security.AuthAttemptsPerMinute,
                Window = TimeSpan.FromMinutes(1),
                SegmentsPerWindow = 6,
                QueueLimit = 0,
            }));

            // Analysis is CPU work. Signed-in users get a larger budget, keyed by account instead of address.
            options.AddPolicy("analyze", context =>
            {
                var userId = context.User.GetUserId();
                return userId is { } id
                    ? RateLimitPartition.GetTokenBucketLimiter($"user:{id}", _ => Bucket(security.AuthenticatedAnalysesPerMinute))
                    : RateLimitPartition.GetTokenBucketLimiter($"ip:{ClientKey(context)}", _ => Bucket(security.AnonymousAnalysesPerMinute));
            });

            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
                RateLimitPartition.GetTokenBucketLimiter($"global:{ClientKey(context)}", _ => Bucket(600)));
        });

    private static TokenBucketRateLimiterOptions Bucket(int perMinute) => new()
    {
        TokenLimit = perMinute,
        TokensPerPeriod = perMinute,
        ReplenishmentPeriod = TimeSpan.FromMinutes(1),
        QueueLimit = 0,
        AutoReplenishment = true,
    };
}
