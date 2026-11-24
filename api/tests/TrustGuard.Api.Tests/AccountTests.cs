using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using TrustGuard.Api.Data;
using TrustGuard.Api.Infrastructure;

namespace TrustGuard.Api.Tests;

[Collection(ApiCollection.Name)]
public class AccountTests(ApiFixture api)
{
    private const string Pii = "Your PayPal account is limited. Card 4111 1111 1111 1111. Verify: https://paypa1-login.top/signin?token=SECRET123";

    [Fact]
    public async Task SettingsDefaultToTheMostPrivateChoiceAndCanBeChanged()
    {
        var session = await api.NewSession().RegisteredAsync();
        var initial = await TestSession.JsonAsync(await session.GetAsync("/api/me/settings"));
        Assert.Equal("off", initial.GetProperty("historyMode").GetString());
        Assert.Equal(30, initial.GetProperty("retentionDays").GetInt32());

        var updated = await TestSession.JsonAsync(await session.PutAsync("/api/me/settings", new { historyMode = "summary", retentionDays = 90 }));
        Assert.Equal("summary", updated.GetProperty("historyMode").GetString());
        Assert.Equal(90, (await TestSession.JsonAsync(await session.GetAsync("/api/me/settings"))).GetProperty("retentionDays").GetInt32());
    }

    [Theory]
    [InlineData("{\"historyMode\":\"summary\",\"retentionDays\":5}")]
    [InlineData("{\"historyMode\":\"everything\",\"retentionDays\":30}")]
    [InlineData("{\"retentionDays\":30}")]
    [InlineData("{\"historyMode\":\"summary\"}")]
    public async Task SettingsRejectInvalidValues(string json)
    {
        var session = await api.NewSession().RegisteredAsync();
        var response = await session.SendAsync(HttpMethod.Put, "/api/me/settings", configure: r => r.Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task SteppingDownFromRedactedTextRemovesWhatWasAlreadyStored()
    {
        var email = TestSession.NewEmail();
        var session = await api.NewSession().RegisteredAsync(email);
        await session.SetHistoryAsync("redacted_text");
        await session.AnalyzeAsync(Pii, "email");

        Assert.NotNull(await api.WithDbAsync(db => db.Analyses.Where(a => db.Users.Any(u => u.Email == email && u.Id == a.UserId)).Select(a => a.RedactedText).SingleAsync()));

        await session.SetHistoryAsync("summary");
        var row = await api.WithDbAsync(db => db.Analyses.AsNoTracking().SingleAsync(a => db.Users.Any(u => u.Email == email && u.Id == a.UserId)));
        Assert.Null(row.RedactedText);
        Assert.Null(row.ResultJson);
        Assert.NotEmpty(row.FindingTitles);

        var detail = await TestSession.JsonAsync(await session.GetAsync($"/api/history/{row.Id}"));
        Assert.False(detail.GetProperty("item").GetProperty("hasDetails").GetBoolean());
        Assert.Equal(JsonValueKind.Null, detail.GetProperty("result").ValueKind);
    }

    [Fact]
    public async Task ChangingRetentionAppliesToAlreadySavedAnalyses()
    {
        var email = TestSession.NewEmail();
        var session = await api.NewSession().RegisteredAsync(email);
        await session.SetHistoryAsync("summary", 365);
        await session.AnalyzeAsync(Pii, "email");

        await session.SetHistoryAsync("summary", 7);
        var row = await api.WithDbAsync(db => db.Analyses.AsNoTracking().SingleAsync(a => db.Users.Any(u => u.Email == email && u.Id == a.UserId)));
        Assert.Equal(TimeSpan.FromDays(7), row.ExpiresAt - row.CreatedAt);
    }

    [Fact]
    public async Task ExpiredAnalysesAreDeletedByTheRetentionJob()
    {
        var email = TestSession.NewEmail();
        var session = await api.NewSession().RegisteredAsync(email);
        await session.SetHistoryAsync("summary", 7);
        await session.AnalyzeAsync(Pii, "email");

        var job = api.Services.GetServices<IHostedService>().OfType<RetentionCleanupService>().Single();

        api.Clock.Advance(TimeSpan.FromDays(6));
        await job.CleanAsync(CancellationToken.None);
        Assert.Equal(1, await api.WithDbAsync(db => db.Analyses.CountAsync(a => db.Users.Any(u => u.Email == email && u.Id == a.UserId))));

        api.Clock.Advance(TimeSpan.FromDays(2));
        await job.CleanAsync(CancellationToken.None);
        Assert.Equal(0, await api.WithDbAsync(db => db.Analyses.CountAsync(a => db.Users.Any(u => u.Email == email && u.Id == a.UserId))));
    }

    [Fact]
    public async Task DeletingTheAccountRequiresThePasswordAndRemovesEverything()
    {
        var email = TestSession.NewEmail();
        var session = await api.NewSession().RegisteredAsync(email);
        await session.SetHistoryAsync("redacted_text");
        await session.AnalyzeAsync(Pii, "email");

        var wrong = await session.DeleteAsync("/api/me", new { password = "not my password" });
        Assert.Equal(HttpStatusCode.Forbidden, wrong.StatusCode);
        Assert.True(await api.WithDbAsync(db => db.Users.AnyAsync(u => u.Email == email)));

        Assert.Equal(HttpStatusCode.NoContent, (await session.DeleteAsync("/api/me", new { password = TestSession.Password })).StatusCode);

        // Cascading foreign keys remove the sessions and every saved analysis with the account.
        Assert.False(await api.WithDbAsync(db => db.Users.AnyAsync(u => u.Email == email)));
        var orphans = await api.WithDbAsync(async db => (await db.Analyses.CountAsync(a => !db.Users.Any(u => u.Id == a.UserId))) + (await db.RefreshTokens.CountAsync(t => !db.Users.Any(u => u.Id == t.UserId))));
        Assert.Equal(0, orphans);

        Assert.Equal(HttpStatusCode.Unauthorized, (await api.NewSession().LoginAsync(email)).StatusCode);
    }
}
