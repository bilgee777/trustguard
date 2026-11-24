using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using TrustGuard.Api.Data;

namespace TrustGuard.Api.Tests;

[Collection(ApiCollection.Name)]
public class HistoryTests(ApiFixture api)
{
    private const string Scam = "URGENT: verify your account at http://paypa1-login.top now";
    private const string Pii = "Hi, your PayPal account is limited. Call +90 532 123 45 67 or mail help@paypa1-support.com. Card 4111 1111 1111 1111, IBAN GB82 WEST 1234 5698 7654 32, code: 482913. Verify: https://paypa1-login.top/signin?token=SECRET123&user=ayse";

    private async Task<List<AnalysisRecord>> RowsFor(string email) =>
        await api.WithDbAsync(db => db.Analyses.AsNoTracking().Where(a => db.Users.Any(u => u.Email == email && u.Id == a.UserId)).ToListAsync());

    /// <summary>Moves the clock forward and refreshes the session, as the web app would when its access token expires.</summary>
    private async Task LaterAsync(TestSession session, TimeSpan time)
    {
        api.Clock.Advance(time);
        (await session.PostAsync("/api/auth/refresh")).EnsureSuccessStatusCode();
    }

    private static async Task<JsonElement> ReadAsync(HttpResponseMessage response) => await TestSession.JsonAsync(response);

    [Fact]
    public async Task NothingIsSavedByDefault()
    {
        var email = TestSession.NewEmail();
        var session = await api.NewSession().RegisteredAsync(email);

        var body = await ReadAsync(await session.AnalyzeAsync(Scam));
        Assert.False(body.GetProperty("saved").GetBoolean());
        Assert.Empty(await RowsFor(email));
    }

    [Fact]
    public async Task SummaryModeKeepsScoresAndIndicatorNamesButNeverTheMessage()
    {
        var email = TestSession.NewEmail();
        var session = await api.NewSession().RegisteredAsync(email);
        await session.SetHistoryAsync("summary");

        var body = await ReadAsync(await session.AnalyzeAsync(Pii, "email"));
        Assert.True(body.GetProperty("saved").GetBoolean());

        var row = Assert.Single(await RowsFor(email));
        Assert.Null(row.RedactedText);
        Assert.Null(row.ResultJson);
        Assert.NotEmpty(row.FindingTitles);
        Assert.NotEmpty(row.Categories);

        var everythingStored = string.Join(' ', row.FindingTitles, string.Join(' ', row.RuleIds), string.Join(' ', row.Categories));
        foreach (var secret in new[] { "4111", "532 123", "482913", "SECRET123", "paypa1-login", "help@" })
        {
            Assert.DoesNotContain(secret, everythingStored, StringComparison.Ordinal);
        }
    }

    [Fact]
    public async Task RedactedTextModeStoresAMaskedCopyAndNoOriginalPersonalData()
    {
        var email = TestSession.NewEmail();
        var session = await api.NewSession().RegisteredAsync(email);
        await session.SetHistoryAsync("redacted_text");

        var body = await ReadAsync(await session.AnalyzeAsync(Pii, "email"));
        Assert.True(body.GetProperty("saved").GetBoolean());
        // The caller sees their own text untouched...
        Assert.Contains("4111 1111 1111 1111", body.GetProperty("result").GetProperty("text").GetString(), StringComparison.Ordinal);

        // ...but the database never receives it.
        var row = Assert.Single(await RowsFor(email));
        var stored = row.RedactedText + " " + row.ResultJson + " " + row.FindingTitles;
        foreach (var secret in new[] { "4111", "532 123", "482913", "SECRET123", "WEST 1234", "help@paypa1" })
        {
            Assert.DoesNotContain(secret, stored, StringComparison.Ordinal);
        }
        Assert.Contains("[card]", row.RedactedText, StringComparison.Ordinal);
        Assert.Contains("[phone]", row.RedactedText, StringComparison.Ordinal);
        Assert.Contains("[iban]", row.RedactedText, StringComparison.Ordinal);
        Assert.Contains("[code]", row.RedactedText, StringComparison.Ordinal);
        Assert.Contains("redacted@paypa1-support.com", row.RedactedText, StringComparison.Ordinal);
    }

    [Fact]
    public async Task HistoryDetailReturnsTheStoredAnalysisOfTheRedactedCopy()
    {
        var session = await api.NewSession().RegisteredAsync();
        await session.SetHistoryAsync("redacted_text");
        var saved = await ReadAsync(await session.AnalyzeAsync(Pii, "email"));
        var id = saved.GetProperty("historyId").GetGuid();

        var detail = await ReadAsync(await session.GetAsync($"/api/history/{id}"));
        Assert.Equal(id, detail.GetProperty("item").GetProperty("id").GetGuid());
        Assert.Equal(id.ToString(), detail.GetProperty("result").GetProperty("id").GetString());
        Assert.Equal(detail.GetProperty("redactedText").GetString(), detail.GetProperty("result").GetProperty("text").GetString());
        Assert.Equal(detail.GetProperty("item").GetProperty("score").GetInt32(), detail.GetProperty("result").GetProperty("score").GetInt32());
        Assert.True(detail.GetProperty("item").GetProperty("hasDetails").GetBoolean());
    }

    [Fact]
    public async Task RedactionKeepsTheSignalsTheEngineNeeds()
    {
        var session = await api.NewSession().RegisteredAsync();
        await session.SetHistoryAsync("redacted_text");
        var immediate = (await ReadAsync(await session.AnalyzeAsync(Pii, "email"))).GetProperty("result").GetProperty("score").GetInt32();

        var history = await ReadAsync(await session.GetAsync("/api/history"));
        var stored = history.GetProperty("items")[0].GetProperty("score").GetInt32();
        Assert.InRange(Math.Abs(immediate - stored), 0, 5);
        Assert.True(stored >= 75, "the redacted copy must still be recognized as critical");
    }

    [Fact]
    public async Task OptOutPerRequestSkipsSaving()
    {
        var email = TestSession.NewEmail();
        var session = await api.NewSession().RegisteredAsync(email);
        await session.SetHistoryAsync("summary");

        var body = await ReadAsync(await session.AnalyzeAsync(Scam, save: false));
        Assert.False(body.GetProperty("saved").GetBoolean());
        Assert.Empty(await RowsFor(email));
    }

    [Fact]
    public async Task ListFiltersSortsSearchesAndPages()
    {
        var session = await api.NewSession().RegisteredAsync();
        await session.SetHistoryAsync("summary", 365);

        // Three analyses on three different days with different risk levels.
        await session.AnalyzeAsync("Running 10 minutes late, order me a coffee please. See you at the station.");
        await LaterAsync(session, TimeSpan.FromDays(1));
        await session.AnalyzeAsync("Send me the OTP code we sent you");
        await LaterAsync(session, TimeSpan.FromDays(1));
        await session.AnalyzeAsync(Scam);

        var all = await ReadAsync(await session.GetAsync("/api/history"));
        Assert.Equal(3, all.GetProperty("total").GetInt32());
        var scores = all.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("score").GetInt32()).ToList();

        var newest = await ReadAsync(await session.GetAsync("/api/history?sort=newest"));
        Assert.Equal(scores, newest.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("score").GetInt32()));

        var oldest = await ReadAsync(await session.GetAsync("/api/history?sort=oldest"));
        Assert.Equal(scores.AsEnumerable().Reverse(), oldest.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("score").GetInt32()));

        var bySeverity = (await ReadAsync(await session.GetAsync("/api/history?sort=score"))).GetProperty("items").EnumerateArray().Select(i => i.GetProperty("score").GetInt32()).ToList();
        Assert.Equal(bySeverity.OrderByDescending(s => s), bySeverity);

        var critical = await ReadAsync(await session.GetAsync("/api/history?level=critical"));
        Assert.Equal(1, critical.GetProperty("total").GetInt32());
        var highOrCritical = await ReadAsync(await session.GetAsync("/api/history?level=high&level=critical"));
        Assert.Equal(2, highOrCritical.GetProperty("total").GetInt32());

        var search = await ReadAsync(await session.GetAsync("/api/history?q=one-time"));
        Assert.Equal(1, search.GetProperty("total").GetInt32());
        Assert.Equal(0, (await ReadAsync(await session.GetAsync("/api/history?q=%25"))).GetProperty("total").GetInt32());

        var today = DateOnly.FromDateTime(api.Clock.GetUtcNow().UtcDateTime);
        var onlyToday = await ReadAsync(await session.GetAsync($"/api/history?from={today:yyyy-MM-dd}&to={today:yyyy-MM-dd}"));
        Assert.Equal(1, onlyToday.GetProperty("total").GetInt32());

        var page = await ReadAsync(await session.GetAsync("/api/history?pageSize=2&page=2"));
        Assert.Equal(3, page.GetProperty("total").GetInt32());
        Assert.Equal(1, page.GetProperty("items").GetArrayLength());
        Assert.Equal(2, page.GetProperty("page").GetInt32());
    }

    [Theory]
    [InlineData("level=extreme")]
    [InlineData("page=0")]
    [InlineData("pageSize=500")]
    [InlineData("from=2026-02-01&to=2026-01-01")]
    [InlineData("from=not-a-date")]
    public async Task ListRejectsInvalidQueries(string query)
    {
        var session = await api.NewSession().RegisteredAsync();
        Assert.Equal(HttpStatusCode.BadRequest, (await session.GetAsync($"/api/history?{query}")).StatusCode);
    }

    [Fact]
    public async Task UsersCanOnlySeeAndDeleteTheirOwnHistory()
    {
        var alice = await api.NewSession().RegisteredAsync();
        await alice.SetHistoryAsync("redacted_text");
        var id = (await ReadAsync(await alice.AnalyzeAsync(Scam))).GetProperty("historyId").GetGuid();

        var bob = await api.NewSession().RegisteredAsync();
        await bob.SetHistoryAsync("summary");

        Assert.Equal(0, (await ReadAsync(await bob.GetAsync("/api/history"))).GetProperty("total").GetInt32());
        Assert.Equal(HttpStatusCode.NotFound, (await bob.GetAsync($"/api/history/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.DeleteAsync($"/api/history/{id}")).StatusCode);

        // Bob's "delete everything" must not touch Alice's data either.
        Assert.Equal(HttpStatusCode.OK, (await bob.DeleteAsync("/api/history")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await alice.GetAsync($"/api/history/{id}")).StatusCode);
    }

    [Fact]
    public async Task AnalysesCanBeDeletedOneByOneOrAllAtOnce()
    {
        var session = await api.NewSession().RegisteredAsync();
        await session.SetHistoryAsync("summary");
        var first = (await ReadAsync(await session.AnalyzeAsync(Scam))).GetProperty("historyId").GetGuid();
        await session.AnalyzeAsync(Scam);
        await session.AnalyzeAsync(Scam);

        Assert.Equal(HttpStatusCode.NoContent, (await session.DeleteAsync($"/api/history/{first}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await session.DeleteAsync($"/api/history/{first}")).StatusCode);
        Assert.Equal(2, (await ReadAsync(await session.GetAsync("/api/history"))).GetProperty("total").GetInt32());

        var deleted = await ReadAsync(await session.DeleteAsync("/api/history"));
        Assert.Equal(2, deleted.GetProperty("deleted").GetInt32());
        Assert.Equal(0, (await ReadAsync(await session.GetAsync("/api/history"))).GetProperty("total").GetInt32());
    }
}
