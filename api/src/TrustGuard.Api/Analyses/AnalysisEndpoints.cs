using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using TrustGuard.Api.Auth;
using TrustGuard.Engine;

namespace TrustGuard.Api.Analyses;

public static class AnalysisEndpoints
{
    public static IEndpointRouteBuilder MapAnalysisEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api").WithTags("Analysis");

        group.MapPost("/analyses", async (AnalyzeRequest request, ClaimsPrincipal principal, [FromServices] HistoryRecorder recorder, CancellationToken ct) =>
            {
                var text = request.Text;
                if (string.IsNullOrWhiteSpace(text))
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["text"] = ["Paste the message you want to check."] });
                }
                if (request.ContentType == ContentType.Url && text.Trim().Any(char.IsWhiteSpace))
                {
                    return Results.ValidationProblem(new Dictionary<string, string[]>
                    {
                        ["text"] = ["Enter a single link without spaces. To check a whole message, choose another content type."],
                    });
                }

                var result = RiskEngine.Analyze(new AnalysisInput(request.ContentType!.Value, text));

                // Anonymous callers (the public demo) get the full analysis; nothing is stored for them.
                Guid? historyId = null;
                if (principal.GetUserId() is { } userId && request.Save != false)
                {
                    historyId = await recorder.RecordAsync(userId, request, result, ct);
                }
                return Results.Ok(new AnalyzeResponse(result, historyId is not null, historyId));
            })
            .RequireRateLimiting("analyze")
            .WithSummary("Analyzes a message or link. Saved to history only for signed-in users who turned history on.");

        group.MapPost("/url-inspections", (InspectUrlRequest request) => Results.Ok(UrlInspector.Inspect(request.Url)))
            .RequireRateLimiting("analyze")
            .WithSummary("Inspects the structure of a link without fetching it.");

        return app;
    }
}
