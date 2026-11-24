using System.Diagnostics;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace TrustGuard.Api.Infrastructure;

/// <summary>
/// Turns known failure modes into precise problem responses. Anything unexpected becomes a generic 500
/// with a trace id: stack traces and exception messages never reach the client.
/// </summary>
public sealed class ApiExceptionHandler(ILogger<ApiExceptionHandler> logger, IProblemDetailsService problems) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        ProblemDetails problem;
        if (exception is BadHttpRequestException badRequest)
        {
            // Malformed JSON, a missing required value, an oversized body: the caller's mistake, not a server fault.
            problem = new ProblemDetails { Status = badRequest.StatusCode, Title = "Invalid request", Detail = "The request is malformed or is missing a required value." };
            problem.Extensions["code"] = "invalid_request";
        }
        else if (exception is RegexMatchTimeoutException)
        {
            logger.LogWarning("Analysis aborted: a pattern exceeded its time budget");
            problem = new ProblemDetails { Status = 422, Title = "Text could not be analyzed", Detail = "This text took too long to analyze. Try a shorter excerpt." };
            problem.Extensions["code"] = "analysis_timeout";
        }
        else
        {
            logger.LogError(exception, "Unhandled exception for {Method} {Path}", context.Request.Method, context.Request.Path);
            problem = new ProblemDetails { Status = 500, Title = "Something went wrong", Detail = "The request could not be completed. Try again, and contact support with the trace id if it keeps failing." };
            problem.Extensions["code"] = "internal_error";
        }

        context.Response.StatusCode = problem.Status!.Value;
        return await problems.TryWriteAsync(new ProblemDetailsContext { HttpContext = context, ProblemDetails = problem, Exception = null });
    }

    public static void Customize(ProblemDetailsContext context)
    {
        context.ProblemDetails.Extensions["traceId"] = Activity.Current?.Id ?? context.HttpContext.TraceIdentifier;
    }
}
