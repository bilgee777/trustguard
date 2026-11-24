using System.Text;
using System.Text.RegularExpressions;
using TrustGuard.Engine;

namespace TrustGuard.Api.Analyses;

/// <summary>
/// Masks personal data before a message is stored (and, in a later phase, before it is sent to an AI model).
/// Detection prefers over-redaction: a wrongly masked number costs nothing, a leaked card number costs a lot.
/// Signals the risk engine needs are kept on purpose: the domain of an email address (for look-alike sender
/// checks) and the host and path of links (the query string and password are removed).
/// </summary>
public static partial class Redactor
{
    private const int MatchTimeoutMs = 1000;

    [GeneratedRegex(@"[\p{L}\p{N}._%+-]+@([\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+)", RegexOptions.CultureInvariant, MatchTimeoutMs)]
    private static partial Regex Email();

    [GeneratedRegex(@"(?<![\d])(?:\d[ -]?){12,18}\d(?![\d])", RegexOptions.CultureInvariant, MatchTimeoutMs)]
    private static partial Regex CardCandidate();

    [GeneratedRegex(@"\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?\b", RegexOptions.CultureInvariant, MatchTimeoutMs)]
    private static partial Regex IbanCandidate();

    [GeneratedRegex(@"(?<![\d-])\d{3}-\d{2}-\d{4}(?![\d-])", RegexOptions.CultureInvariant, MatchTimeoutMs)]
    private static partial Regex UsSocialSecurity();

    [GeneratedRegex(@"(?<!\d)[1-9]\d{10}(?!\d)", RegexOptions.CultureInvariant, MatchTimeoutMs)]
    private static partial Regex TurkishNationalId();

    [GeneratedRegex(@"(?<![\w])[+(]?\d[\d ()./-]{6,}\d(?![\w])", RegexOptions.CultureInvariant, MatchTimeoutMs)]
    private static partial Regex PhoneCandidate();

    [GeneratedRegex(@"\b(?:code|otp|pin|passcode|verification|kod|sifre|şifre)\b(?<gap>[^\d\n]{0,20})(?<digits>\d{4,8})(?!\d)", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, MatchTimeoutMs)]
    private static partial Regex OneTimeCode();

    private readonly record struct Replacement(int Start, int End, string Text);

    public static string Redact(string text)
    {
        var replacements = new List<Replacement>();

        void Add(int start, int end, string replacement)
        {
            // The first detector to claim a stretch of text wins, so a link is never also treated as an email.
            if (replacements.Any(r => start < r.End && r.Start < end)) return;
            replacements.Add(new Replacement(start, end, replacement));
        }

        foreach (var url in UrlInspector.ExtractUrls(text))
        {
            var redacted = RedactUrl(url.Value);
            if (!string.Equals(redacted, url.Value, StringComparison.Ordinal)) Add(url.Start, url.End, redacted);
            else Add(url.Start, url.End, url.Value);
        }

        foreach (Match m in Email().Matches(text)) Add(m.Index, m.Index + m.Length, $"redacted@{m.Groups[1].Value}");
        foreach (Match m in CardCandidate().Matches(text)) if (PassesLuhn(m.Value)) Add(m.Index, m.Index + m.Length, "[card]");
        foreach (Match m in IbanCandidate().Matches(text)) if (IsValidIban(m.Value)) Add(m.Index, m.Index + m.Length, "[iban]");
        foreach (Match m in UsSocialSecurity().Matches(text)) Add(m.Index, m.Index + m.Length, "[id]");
        foreach (Match m in TurkishNationalId().Matches(text)) if (IsValidTurkishId(m.Value)) Add(m.Index, m.Index + m.Length, "[id]");

        foreach (Match m in OneTimeCode().Matches(text))
        {
            var digits = m.Groups["digits"];
            Add(digits.Index, digits.Index + digits.Length, "[code]");
        }

        foreach (Match m in PhoneCandidate().Matches(text))
        {
            var count = m.Value.Count(char.IsAsciiDigit);
            if (count is >= 9 and <= 15) Add(m.Index, m.Index + m.Length, "[phone]");
        }

        var builder = new StringBuilder(text.Length);
        var position = 0;
        foreach (var replacement in replacements.OrderBy(r => r.Start))
        {
            builder.Append(text, position, replacement.Start - position).Append(replacement.Text);
            position = replacement.End;
        }
        return builder.Append(text, position, text.Length - position).ToString();
    }

    /// <summary>Removes the password, query values and fragment of a link, keeping scheme, username, host and path.</summary>
    internal static string RedactUrl(string url)
    {
        var fragment = url.IndexOf('#', StringComparison.Ordinal);
        var withoutFragment = fragment < 0 ? url : url[..fragment];
        var question = withoutFragment.IndexOf('?', StringComparison.Ordinal);
        var beforeQuery = question < 0 ? withoutFragment : withoutFragment[..question];
        var query = question < 0 ? "" : withoutFragment[(question + 1)..];

        var schemeEnd = beforeQuery.IndexOf("://", StringComparison.Ordinal);
        var prefix = schemeEnd < 0 ? "" : beforeQuery[..(schemeEnd + 3)];
        var rest = schemeEnd < 0 ? beforeQuery : beforeQuery[(schemeEnd + 3)..];
        var slash = rest.IndexOf('/', StringComparison.Ordinal);
        var authority = slash < 0 ? rest : rest[..slash];
        var path = slash < 0 ? "" : rest[slash..];

        var at = authority.LastIndexOf('@');
        if (at >= 0)
        {
            var userinfo = authority[..at];
            var colon = userinfo.IndexOf(':', StringComparison.Ordinal);
            if (colon >= 0) authority = $"{userinfo[..colon]}:redacted{authority[at..]}";
        }

        var result = prefix + authority + path;
        if (query.Length == 0) return result;

        var pairs = query.Split('&', StringSplitOptions.RemoveEmptyEntries).Select(pair =>
        {
            var equals = pair.IndexOf('=', StringComparison.Ordinal);
            return equals < 0 ? pair : $"{pair[..equals]}=redacted";
        });
        return $"{result}?{string.Join('&', pairs)}";
    }

    internal static bool PassesLuhn(string candidate)
    {
        var digits = candidate.Where(char.IsAsciiDigit).Select(c => c - '0').ToArray();
        if (digits.Length is < 13 or > 19 || digits.Distinct().Count() == 1) return false;
        var sum = 0;
        for (var i = 0; i < digits.Length; i++)
        {
            var digit = digits[^(i + 1)];
            if (i % 2 == 1)
            {
                digit *= 2;
                if (digit > 9) digit -= 9;
            }
            sum += digit;
        }
        return sum % 10 == 0;
    }

    internal static bool IsValidIban(string candidate)
    {
        var iban = candidate.Replace(" ", "", StringComparison.Ordinal);
        if (iban.Length is < 15 or > 34) return false;

        var rearranged = iban[4..] + iban[..4];
        var remainder = 0;
        foreach (var c in rearranged)
        {
            var value = char.IsAsciiDigit(c) ? c - '0' : c - 'A' + 10;
            remainder = value > 9 ? (remainder * 100 + value) % 97 : (remainder * 10 + value) % 97;
        }
        return remainder == 1;
    }

    internal static bool IsValidTurkishId(string candidate)
    {
        if (candidate.Length != 11 || candidate[0] == '0') return false;
        var d = candidate.Select(c => c - '0').ToArray();
        var tenth = ((d[0] + d[2] + d[4] + d[6] + d[8]) * 7 - (d[1] + d[3] + d[5] + d[7])) % 10;
        if (tenth < 0) tenth += 10;
        return tenth == d[9] && d.Take(10).Sum() % 10 == d[10];
    }
}
