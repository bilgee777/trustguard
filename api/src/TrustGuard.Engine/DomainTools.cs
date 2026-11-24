namespace TrustGuard.Engine;

internal readonly record struct DomainSplit(string Registrable, string Name, string Suffix, string Subdomain);

/// <summary>
/// Simplified registrable-domain logic. A production system should use the full Public Suffix List;
/// the shared list covers the most common multi-label suffixes (a documented limitation).
/// </summary>
internal static class DomainTools
{
    public static DomainSplit SplitDomain(string host)
    {
        var labels = host.Split('.').Where(l => l.Length > 0).ToArray();
        if (labels.Length < 2) return new DomainSplit(host, host, "", "");

        var lastTwo = string.Join('.', labels[^2..]);
        var suffixLength = EngineData.MultiLabelSuffixes.Contains(lastTwo) && labels.Length > 2 ? 2 : 1;
        var registrable = labels[^(suffixLength + 1)..];
        return new DomainSplit(
            string.Join('.', registrable),
            registrable[0],
            string.Join('.', labels[^suffixLength..]),
            string.Join('.', labels[..^(suffixLength + 1)]));
    }

    /// <summary>Four dotted decimal octets, or null. Hosts reach this already normalized by the URL parser.</summary>
    public static int[]? ParseIPv4(string host)
    {
        var parts = host.Split('.');
        if (parts.Length != 4) return null;
        var octets = new int[4];
        for (var i = 0; i < 4; i++)
        {
            var part = parts[i];
            if (part.Length is < 1 or > 3 || !part.All(JsText.IsAsciiDigit)) return null;
            octets[i] = int.Parse(part, System.Globalization.CultureInfo.InvariantCulture);
            if (octets[i] > 255) return null;
        }
        return octets;
    }

    /// <summary>Loopback, private, link-local and other non-public ranges (relevant to SSRF protection).</summary>
    public static bool IsNonPublicIPv4(int[] octets)
    {
        var a = octets[0];
        var b = octets[1];
        return a == 0 || a == 10 || a == 127 || (a == 169 && b == 254) || (a == 172 && b is >= 16 and <= 31)
            || (a == 192 && b == 168) || (a == 100 && b is >= 64 and <= 127) || a >= 224;
    }

    public static bool IsNonPublicIPv6(string host)
    {
        var h = host;
        if (h.StartsWith('[')) h = h[1..];
        if (h.EndsWith(']')) h = h[..^1];
        h = h.ToLowerInvariant();
        return h is "::1" or "::" || h.StartsWith("fc", StringComparison.Ordinal) || h.StartsWith("fd", StringComparison.Ordinal)
            || (h.Length >= 3 && h.StartsWith("fe", StringComparison.Ordinal) && h[2] is '8' or '9' or 'a' or 'b')
            || h.StartsWith("::ffff:", StringComparison.Ordinal);
    }
}
