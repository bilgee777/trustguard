using System.Net.Http.Json;
using System.Text.Json;
using TrustGuard.Engine;

namespace TrustGuard.Api.Tests;

/// <summary>
/// A browser stand-in: keeps its own cookie jar (so tests can replay old cookies or drop them) and,
/// like the web app, copies the CSRF cookie into the X-CSRF-Token header unless told not to.
/// </summary>
public sealed class TestSession(HttpClient http)
{
    public const string Password = "correct horse battery staple";

    private static int _counter;
    private readonly Dictionary<string, string> _cookies = new(StringComparer.Ordinal);

    public string? Cookie(string name) => _cookies.GetValueOrDefault(name);

    public void SetCookie(string name, string? value)
    {
        if (value is null) _cookies.Remove(name);
        else _cookies[name] = value;
    }

    public IReadOnlyDictionary<string, string> Cookies => _cookies;

    public static string NewEmail() => $"user{Interlocked.Increment(ref _counter)}-{Guid.NewGuid():N}@example.com";

    public async Task<HttpResponseMessage> SendAsync(HttpMethod method, string url, object? body = null, bool csrf = true, Action<HttpRequestMessage>? configure = null)
    {
        var request = new HttpRequestMessage(method, url);
        if (body is not null) request.Content = JsonContent.Create(body, options: EngineJson.Options);
        if (_cookies.Count > 0) request.Headers.Add("Cookie", string.Join("; ", _cookies.Select(c => $"{c.Key}={c.Value}")));
        if (csrf && _cookies.TryGetValue("tg_csrf", out var token)) request.Headers.Add("X-CSRF-Token", token);
        configure?.Invoke(request);

        var response = await http.SendAsync(request);
        Absorb(response);
        return response;
    }

    private void Absorb(HttpResponseMessage response)
    {
        if (!response.Headers.TryGetValues("Set-Cookie", out var headers)) return;
        foreach (var header in headers)
        {
            var pair = header.Split(';')[0];
            var separator = pair.IndexOf('=', StringComparison.Ordinal);
            var name = pair[..separator];
            var value = pair[(separator + 1)..];
            if (value.Length == 0) _cookies.Remove(name);
            else _cookies[name] = value;
        }
    }

    public Task<HttpResponseMessage> GetAsync(string url) => SendAsync(HttpMethod.Get, url);

    public Task<HttpResponseMessage> PostAsync(string url, object? body = null, bool csrf = true) => SendAsync(HttpMethod.Post, url, body, csrf);

    public Task<HttpResponseMessage> PutAsync(string url, object body) => SendAsync(HttpMethod.Put, url, body);

    public Task<HttpResponseMessage> DeleteAsync(string url, object? body = null) => SendAsync(HttpMethod.Delete, url, body);

    public static async Task<JsonElement> JsonAsync(HttpResponseMessage response) => await response.Content.ReadFromJsonAsync<JsonElement>(EngineJson.Options);

    public async Task<HttpResponseMessage> RegisterAsync(string? email = null, string password = Password, string displayName = "Test User")
    {
        // Like the SPA, fetch a CSRF token first so even the first state-changing call carries one.
        await GetAsync("/api/auth/csrf");
        return await PostAsync("/api/auth/register", new { email = email ?? NewEmail(), password, displayName });
    }

    public async Task<TestSession> RegisteredAsync(string? email = null)
    {
        var response = await RegisterAsync(email);
        response.EnsureSuccessStatusCode();
        return this;
    }

    public async Task<HttpResponseMessage> LoginAsync(string email, string password = Password)
    {
        await GetAsync("/api/auth/csrf");
        return await PostAsync("/api/auth/login", new { email, password });
    }

    public Task<HttpResponseMessage> AnalyzeAsync(string text, string contentType = "sms", bool? save = null) =>
        PostAsync("/api/analyses", save is null ? new { contentType, text } : new { contentType, text, save });

    public async Task SetHistoryAsync(string mode, int days = 30) =>
        (await PutAsync("/api/me/settings", new { historyMode = mode, retentionDays = days })).EnsureSuccessStatusCode();
}
