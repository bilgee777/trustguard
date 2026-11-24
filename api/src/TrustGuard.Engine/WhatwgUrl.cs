using System.Numerics;
using System.Text;

namespace TrustGuard.Engine;

internal sealed record ParsedUrl(string Scheme, string Username, string Password, string Hostname, string Port, string Pathname, string Search);

/// <summary>
/// A WHATWG URL parser covering the parts the risk engine inspects: special schemes, authority and
/// userinfo, IDNA hosts, IPv4 (decimal, octal and hex forms) and IPv6 hosts, ports, dot-segment
/// removal and percent-encoding. It exists because System.Uri normalizes hosts differently from
/// browsers, and the engine must see the address the way a browser does.
/// Output is verified against Node's URL implementation by a golden-file test (shared/engine/url-parse-expected.json).
/// Not covered: Windows drive letters in file URLs, full UTS46 validity tables and bidi rules.
/// </summary>
internal static class WhatwgUrl
{
    private static readonly Dictionary<string, int> SpecialSchemes = new(StringComparer.Ordinal)
    {
        ["ftp"] = 21,
        ["file"] = -1,
        ["http"] = 80,
        ["https"] = 443,
        ["ws"] = 80,
        ["wss"] = 443,
    };

    // ---- percent-encode sets (URL Standard §1.3) ---------------------------------------------------

    private static bool InC0ControlSet(int cp) => cp <= 0x1F || cp > 0x7E;

    private static bool InQuerySet(int cp) => InC0ControlSet(cp) || cp is ' ' or '"' or '#' or '<' or '>';

    private static bool InSpecialQuerySet(int cp) => InQuerySet(cp) || cp == '\'';

    private static bool InPathSet(int cp) => InQuerySet(cp) || cp is '?' or '`' or '{' or '}';

    private static bool InUserinfoSet(int cp) => InPathSet(cp) || cp is '/' or ':' or ';' or '=' or '@' or '[' or '\\' or ']' or '^' or '|';

    private static string PercentEncode(string value, Func<int, bool> inSet)
    {
        var builder = new StringBuilder(value.Length);
        Span<byte> bytes = stackalloc byte[4];
        foreach (var rune in value.EnumerateRunes())
        {
            if (rune.Value < 0x80 && !inSet(rune.Value))
            {
                builder.Append((char)rune.Value);
                continue;
            }
            var length = rune.EncodeToUtf8(bytes);
            for (var i = 0; i < length; i++) builder.Append('%').Append(bytes[i].ToString("X2", System.Globalization.CultureInfo.InvariantCulture));
        }
        return builder.ToString();
    }

    private static string PercentDecode(string value)
    {
        var bytes = Encoding.UTF8.GetBytes(value);
        var output = new List<byte>(bytes.Length);
        for (var i = 0; i < bytes.Length; i++)
        {
            if (bytes[i] == '%' && i + 2 < bytes.Length && IsHex((char)bytes[i + 1]) && IsHex((char)bytes[i + 2]))
            {
                output.Add((byte)(HexValue((char)bytes[i + 1]) * 16 + HexValue((char)bytes[i + 2])));
                i += 2;
            }
            else
            {
                output.Add(bytes[i]);
            }
        }
        return Encoding.UTF8.GetString(output.ToArray());
    }

    private static bool IsHex(char c) => c is >= '0' and <= '9' or >= 'a' and <= 'f' or >= 'A' and <= 'F';

    private static int HexValue(char c) => c <= '9' ? c - '0' : (c | 0x20) - 'a' + 10;

    // ---- entry point -------------------------------------------------------------------------------

    public static ParsedUrl? Parse(string input)
    {
        var start = 0;
        var end = input.Length;
        while (start < end && input[start] <= ' ') start++;
        while (end > start && input[end - 1] <= ' ') end--;
        var text = new string(input[start..end].Where(c => c is not ('\t' or '\n' or '\r')).ToArray());

        var colon = text.IndexOf(':', StringComparison.Ordinal);
        if (colon <= 0 || !JsText.IsAsciiLetter(text[0])) return null;
        for (var i = 1; i < colon; i++)
        {
            if (!(JsText.IsAsciiLetter(text[i]) || JsText.IsAsciiDigit(text[i]) || text[i] is '+' or '-' or '.')) return null;
        }

        var scheme = text[..colon].ToLowerInvariant();
        var special = SpecialSchemes.TryGetValue(scheme, out var defaultPort);
        var rest = text[(colon + 1)..];

        var hash = rest.IndexOf('#', StringComparison.Ordinal);
        if (hash >= 0) rest = rest[..hash];
        var query = "";
        var question = rest.IndexOf('?', StringComparison.Ordinal);
        if (question >= 0)
        {
            query = rest[(question + 1)..];
            rest = rest[..question];
        }

        string username = "", password = "", hostname = "", port = "";
        string pathPart;

        if (scheme == "file")
        {
            if (rest.Length >= 2 && rest[0] is '/' or '\\' && rest[1] is '/' or '\\')
            {
                rest = rest[2..];
                var slash = rest.IndexOfAny(['/', '\\']);
                var hostText = slash < 0 ? rest : rest[..slash];
                pathPart = slash < 0 ? "" : rest[slash..];
                if (hostText.Length > 0)
                {
                    var host = ParseHost(hostText, special: true);
                    if (host is null) return null;
                    hostname = host == "localhost" ? "" : host;
                }
            }
            else
            {
                pathPart = rest;
            }
        }
        else if (special)
        {
            var skip = 0;
            while (skip < rest.Length && rest[skip] is '/' or '\\') skip++;
            rest = rest[skip..];
            var slash = rest.IndexOfAny(['/', '\\']);
            var authority = slash < 0 ? rest : rest[..slash];
            pathPart = slash < 0 ? "" : rest[slash..];
            if (!ParseAuthority(authority, special: true, defaultPort, out username, out password, out hostname, out port)) return null;
        }
        else if (rest.StartsWith("//", StringComparison.Ordinal))
        {
            rest = rest[2..];
            var slash = rest.IndexOf('/', StringComparison.Ordinal);
            var authority = slash < 0 ? rest : rest[..slash];
            pathPart = slash < 0 ? "" : rest[slash..];
            if (!ParseAuthority(authority, special: false, defaultPort: -1, out username, out password, out hostname, out port)) return null;
        }
        else
        {
            pathPart = rest;
        }

        var search = query.Length == 0 ? "" : "?" + PercentEncode(query, special ? InSpecialQuerySet : InQuerySet);
        return new ParsedUrl(scheme, username, password, hostname, port, ParsePath(pathPart, special), search);
    }

    // ---- authority ---------------------------------------------------------------------------------

    private static bool ParseAuthority(
        string authority, bool special, int defaultPort,
        out string username, out string password, out string hostname, out string port)
    {
        username = password = hostname = port = "";

        var hostPort = authority;
        var at = authority.LastIndexOf('@');
        if (at >= 0)
        {
            var userinfo = authority[..at];
            hostPort = authority[(at + 1)..];
            if (hostPort.Length == 0) return false;
            var passwordStart = userinfo.IndexOf(':', StringComparison.Ordinal);
            username = PercentEncode(passwordStart < 0 ? userinfo : userinfo[..passwordStart], InUserinfoSet);
            password = passwordStart < 0 ? "" : PercentEncode(userinfo[(passwordStart + 1)..], InUserinfoSet);
        }

        var insideBrackets = false;
        var colonIndex = -1;
        for (var i = 0; i < hostPort.Length; i++)
        {
            var c = hostPort[i];
            if (c == '[') insideBrackets = true;
            else if (c == ']') insideBrackets = false;
            else if (c == ':' && !insideBrackets)
            {
                colonIndex = i;
                break;
            }
        }

        var hostText = colonIndex < 0 ? hostPort : hostPort[..colonIndex];
        var portText = colonIndex < 0 ? "" : hostPort[(colonIndex + 1)..];

        if (hostText.Length == 0 && (special || colonIndex >= 0)) return false;

        if (hostText.Length > 0)
        {
            var host = ParseHost(hostText, special);
            if (host is null) return false;
            hostname = host;
        }

        if (portText.Length > 0)
        {
            if (!portText.All(JsText.IsAsciiDigit)) return false;
            var value = BigInteger.Parse(portText, System.Globalization.CultureInfo.InvariantCulture);
            if (value > 65535) return false;
            port = value == defaultPort ? "" : value.ToString(System.Globalization.CultureInfo.InvariantCulture);
        }
        return true;
    }

    // ---- host --------------------------------------------------------------------------------------

    private static bool IsForbiddenHostCodePoint(char c) =>
        c is '\0' or '\t' or '\n' or '\r' or ' ' or '#' or '/' or ':' or '<' or '>' or '?' or '@' or '[' or '\\' or ']' or '^' or '|';

    private static bool IsForbiddenDomainCodePoint(char c) => IsForbiddenHostCodePoint(c) || c <= 0x1F || c == '%' || c == 0x7F;

    private static string? ParseHost(string input, bool special)
    {
        if (input.StartsWith('['))
        {
            if (!input.EndsWith(']')) return null;
            var address = ParseIPv6(input[1..^1]);
            return address is null ? null : $"[{address}]";
        }

        if (!special)
        {
            return input.Any(IsForbiddenHostCodePoint) ? null : PercentEncode(input, InC0ControlSet);
        }

        var ascii = DomainToAscii(PercentDecode(input));
        if (string.IsNullOrEmpty(ascii) || ascii.Any(IsForbiddenDomainCodePoint)) return null;
        return EndsInANumber(ascii) ? ParseIPv4(ascii) : ascii;
    }

    /// <summary>UTS46 characters that map to nothing ("ignored"), such as the soft hyphen and zero-width space.</summary>
    private static bool IsIgnoredByIdna(char c) =>
        c is '­' or '͏' or '᠋' or '᠌' or '᠍' or '᠏' or '​' or '⁠' or '﻿'
        || c is >= '︀' and <= '️';

    /// <summary>
    /// A practical subset of UTS46 ToASCII (non-transitional, as browsers use): map, normalize, then
    /// Punycode-encode non-ASCII labels. Existing xn-- labels must decode to something plausible.
    /// </summary>
    private static string? DomainToAscii(string domain)
    {
        var mapped = domain;
        if (domain.Any(c => c >= 0x80))
        {
            var cleaned = new string(domain.Where(c => !IsIgnoredByIdna(c)).ToArray())
                .Replace('。', '.').Replace('｡', '.');
            try
            {
                mapped = cleaned.ToLowerInvariant().Normalize(NormalizationForm.FormKC).ToLowerInvariant();
            }
            catch (ArgumentException)
            {
                return null;
            }
        }
        else
        {
            mapped = domain.ToLowerInvariant();
        }

        var labels = new List<string>();
        foreach (var label in mapped.Split('.'))
        {
            if (label.All(c => c < 0x80))
            {
                if (label.StartsWith("xn--", StringComparison.Ordinal) && !IsPlausibleALabel(label[4..])) return null;
                labels.Add(label);
                continue;
            }
            var encoded = Punycode.EncodeLabel(label);
            if (encoded is null) return null;
            labels.Add("xn--" + encoded);
        }
        return string.Join('.', labels);
    }

    /// <summary>
    /// Rejects labels such as "xn--a", which decodes to a control character. A full check needs the
    /// IDNA validity tables; this catches malformed Punycode, controls, and unmapped (uppercase) text.
    /// </summary>
    private static bool IsPlausibleALabel(string punycode)
    {
        var decoded = Punycode.DecodeLabel(punycode);
        if (string.IsNullOrEmpty(decoded)) return false;
        if (decoded.Any(c => c is >= '\u0080' and <= '\u009F')) return false;
        try
        {
            return string.Equals(decoded, decoded.ToLowerInvariant().Normalize(NormalizationForm.FormKC).ToLowerInvariant(), StringComparison.Ordinal);
        }
        catch (ArgumentException)
        {
            return false;
        }
    }

    // ---- IPv4 --------------------------------------------------------------------------------------

    private static BigInteger? ParseIPv4Number(string input)
    {
        if (input.Length == 0) return null;
        var radix = 10;
        var digits = input;
        if (digits.Length >= 2 && (digits.StartsWith("0x", StringComparison.Ordinal) || digits.StartsWith("0X", StringComparison.Ordinal)))
        {
            digits = digits[2..];
            radix = 16;
        }
        else if (digits.Length >= 2 && digits[0] == '0')
        {
            digits = digits[1..];
            radix = 8;
        }
        if (digits.Length == 0) return BigInteger.Zero;

        BigInteger value = BigInteger.Zero;
        foreach (var c in digits)
        {
            var digit = IsHex(c) ? HexValue(c) : 99;
            if (digit >= radix) return null;
            value = value * radix + digit;
        }
        return value;
    }

    private static bool EndsInANumber(string host)
    {
        var parts = host.Split('.').ToList();
        if (parts[^1].Length == 0)
        {
            if (parts.Count == 1) return false;
            parts.RemoveAt(parts.Count - 1);
        }
        var last = parts[^1];
        if (last.Length > 0 && last.All(JsText.IsAsciiDigit)) return true;
        return ParseIPv4Number(last) is not null;
    }

    private static string? ParseIPv4(string host)
    {
        var parts = host.Split('.').ToList();
        if (parts[^1].Length == 0 && parts.Count > 1) parts.RemoveAt(parts.Count - 1);
        if (parts.Count > 4) return null;

        var numbers = new List<BigInteger>();
        foreach (var part in parts)
        {
            var number = ParseIPv4Number(part);
            if (number is null) return null;
            numbers.Add(number.Value);
        }
        if (numbers.Take(numbers.Count - 1).Any(n => n > 255)) return null;
        if (numbers[^1] >= BigInteger.Pow(256, 5 - numbers.Count)) return null;

        var address = numbers[^1];
        for (var i = 0; i < numbers.Count - 1; i++) address += numbers[i] * BigInteger.Pow(256, 3 - i);

        var octets = new int[4];
        for (var i = 3; i >= 0; i--)
        {
            octets[i] = (int)(address % 256);
            address /= 256;
        }
        return string.Join('.', octets);
    }

    // ---- IPv6 --------------------------------------------------------------------------------------

    private static string? ParseIPv6(string input)
    {
        var address = new int[8];
        var pieceIndex = 0;
        int? compress = null;
        var p = 0;

        if (input.Length > 0 && input[0] == ':')
        {
            if (input.Length < 2 || input[1] != ':') return null;
            p += 2;
            pieceIndex++;
            compress = pieceIndex;
        }

        while (p < input.Length)
        {
            if (pieceIndex == 8) return null;
            if (input[p] == ':')
            {
                if (compress is not null) return null;
                p++;
                pieceIndex++;
                compress = pieceIndex;
                continue;
            }

            var value = 0;
            var length = 0;
            while (length < 4 && p < input.Length && IsHex(input[p]))
            {
                value = value * 16 + HexValue(input[p]);
                p++;
                length++;
            }

            if (p < input.Length && input[p] == '.')
            {
                if (length == 0) return null;
                p -= length;
                if (pieceIndex > 6) return null;

                var numbersSeen = 0;
                while (p < input.Length)
                {
                    int? ipv4Piece = null;
                    if (numbersSeen > 0)
                    {
                        if (input[p] == '.' && numbersSeen < 4) p++;
                        else return null;
                    }
                    if (p >= input.Length || !JsText.IsAsciiDigit(input[p])) return null;
                    while (p < input.Length && JsText.IsAsciiDigit(input[p]))
                    {
                        var number = input[p] - '0';
                        if (ipv4Piece is null) ipv4Piece = number;
                        else if (ipv4Piece == 0) return null;
                        else ipv4Piece = ipv4Piece * 10 + number;
                        if (ipv4Piece > 255) return null;
                        p++;
                    }
                    address[pieceIndex] = address[pieceIndex] * 0x100 + ipv4Piece!.Value;
                    numbersSeen++;
                    if (numbersSeen is 2 or 4) pieceIndex++;
                }
                if (numbersSeen != 4) return null;
                break;
            }
            if (p < input.Length && input[p] == ':')
            {
                p++;
                if (p >= input.Length) return null;
            }
            else if (p < input.Length)
            {
                return null;
            }
            address[pieceIndex] = value;
            pieceIndex++;
        }

        if (compress is not null)
        {
            var swaps = pieceIndex - compress.Value;
            pieceIndex = 7;
            while (pieceIndex != 0 && swaps > 0)
            {
                (address[pieceIndex], address[compress.Value + swaps - 1]) = (address[compress.Value + swaps - 1], address[pieceIndex]);
                pieceIndex--;
                swaps--;
            }
        }
        else if (pieceIndex != 8)
        {
            return null;
        }

        return SerializeIPv6(address);
    }

    private static string SerializeIPv6(int[] address)
    {
        var bestStart = -1;
        var bestLength = 0;
        for (var i = 0; i < 8;)
        {
            if (address[i] != 0)
            {
                i++;
                continue;
            }
            var j = i;
            while (j < 8 && address[j] == 0) j++;
            if (j - i > bestLength)
            {
                bestStart = i;
                bestLength = j - i;
            }
            i = j;
        }
        if (bestLength < 2) bestStart = -1;

        var builder = new StringBuilder();
        var ignoreZeros = false;
        for (var i = 0; i < 8; i++)
        {
            if (ignoreZeros && address[i] == 0) continue;
            ignoreZeros = false;
            if (bestStart == i)
            {
                builder.Append(i == 0 ? "::" : ":");
                ignoreZeros = true;
                continue;
            }
            builder.Append(address[i].ToString("x", System.Globalization.CultureInfo.InvariantCulture));
            if (i != 7) builder.Append(':');
        }
        return builder.ToString();
    }

    // ---- path --------------------------------------------------------------------------------------

    private static bool IsSingleDot(string segment) => segment == "." || string.Equals(segment, "%2e", StringComparison.OrdinalIgnoreCase);

    private static bool IsDoubleDot(string segment) =>
        segment == ".." || string.Equals(segment, ".%2e", StringComparison.OrdinalIgnoreCase)
        || string.Equals(segment, "%2e.", StringComparison.OrdinalIgnoreCase) || string.Equals(segment, "%2e%2e", StringComparison.OrdinalIgnoreCase);

    private static string ParsePath(string raw, bool special)
    {
        if (raw.Length == 0) return special ? "/" : "";

        var startsWithSlash = raw[0] == '/' || (special && raw[0] == '\\');
        if (!startsWithSlash) return PercentEncode(raw, InC0ControlSet);

        var body = raw[1..];
        var parts = special ? body.Split(['/', '\\']) : body.Split('/');
        var segments = new List<string>();
        for (var i = 0; i < parts.Length; i++)
        {
            var isLast = i == parts.Length - 1;
            if (IsDoubleDot(parts[i]))
            {
                if (segments.Count > 0) segments.RemoveAt(segments.Count - 1);
                if (isLast) segments.Add("");
            }
            else if (IsSingleDot(parts[i]))
            {
                if (isLast) segments.Add("");
            }
            else
            {
                segments.Add(PercentEncode(parts[i], InPathSet));
            }
        }
        return "/" + string.Join('/', segments);
    }
}
