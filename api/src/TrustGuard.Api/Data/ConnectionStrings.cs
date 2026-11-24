using Npgsql;

namespace TrustGuard.Api.Data;

public static class ConnectionStrings
{
    /// <summary>
    /// Accepts both Npgsql keyword strings and the postgresql:// URLs that hosted providers such as
    /// Neon hand out, and returns a keyword string. Remote hosts default to SSL.
    /// </summary>
    public static string Normalize(string value)
    {
        if (!value.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase)
            && !value.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
        {
            return value;
        }

        var uri = new Uri(value);
        var credentials = uri.UserInfo.Split(':', 2);
        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = uri.Host,
            Port = uri.IsDefaultPort ? 5432 : uri.Port,
            Database = Uri.UnescapeDataString(uri.AbsolutePath.TrimStart('/')),
            Username = Uri.UnescapeDataString(credentials[0]),
        };
        if (credentials.Length > 1) builder.Password = Uri.UnescapeDataString(credentials[1]);

        var isLocal = uri.Host is "localhost" or "127.0.0.1" or "::1" or "postgres" or "db";
        builder.SslMode = isLocal ? SslMode.Prefer : SslMode.Require;

        foreach (var pair in uri.Query.TrimStart('?').Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            var parts = pair.Split('=', 2);
            var key = Uri.UnescapeDataString(parts[0]);
            var setting = parts.Length > 1 ? Uri.UnescapeDataString(parts[1]) : "";
            switch (key.ToLowerInvariant())
            {
                case "sslmode" when Enum.TryParse<SslMode>(setting.Replace("-", "", StringComparison.Ordinal), ignoreCase: true, out var mode):
                    builder.SslMode = mode;
                    break;
                case "channel_binding" when Enum.TryParse<ChannelBinding>(setting, ignoreCase: true, out var binding):
                    builder.ChannelBinding = binding;
                    break;
            }
        }
        return builder.ConnectionString;
    }
}
