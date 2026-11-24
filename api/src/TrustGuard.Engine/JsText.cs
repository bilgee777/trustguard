namespace TrustGuard.Engine;

/// <summary>
/// JavaScript string semantics the TypeScript engine relies on. .NET's built-in versions differ in
/// small ways (Trim ignores U+FEFF, Math.Round is banker's rounding), and every difference would
/// become a score difference between the two engines.
/// </summary>
internal static class JsText
{
    /// <summary>The characters JavaScript's \s and String.prototype.trim() treat as whitespace.</summary>
    public static bool IsWhitespace(char c) => c switch
    {
        '\t' or '\n' or '\v' or '\f' or '\r' or ' ' or '\u00A0' or '\u1680' or '\u2028' or '\u2029'
            or '\u202F' or '\u205F' or '\u3000' or '\uFEFF' => true,
        >= '\u2000' and <= '\u200A' => true,
        _ => false,
    };

    public static string Trim(string value)
    {
        var start = 0;
        var end = value.Length;
        while (start < end && IsWhitespace(value[start])) start++;
        while (end > start && IsWhitespace(value[end - 1])) end--;
        return value[start..end];
    }

    /// <summary>Number of whitespace-separated words, like text.trim().split(/\s+/).filter(Boolean).length.</summary>
    public static int CountWords(string value)
    {
        var words = 0;
        var inWord = false;
        foreach (var c in value)
        {
            if (IsWhitespace(c)) inWord = false;
            else if (!inWord)
            {
                inWord = true;
                words++;
            }
        }
        return words;
    }

    /// <summary>Math.round: halves round up. For the non-negative values used here this equals AwayFromZero.</summary>
    public static int Round(double value) => (int)Math.Round(value, MidpointRounding.AwayFromZero);

    public static double RoundTo6(double value) => Math.Round(value * 1e6, MidpointRounding.AwayFromZero) / 1e6;

    public static string LowerFirst(string value) =>
        value.Length == 0 ? value : char.ToLowerInvariant(value[0]) + value[1..];

    public static bool IsAsciiDigit(char c) => c is >= '0' and <= '9';

    public static bool IsAsciiLetter(char c) => c is >= 'a' and <= 'z' or >= 'A' and <= 'Z';

    /// <summary>
    /// decodeURIComponent, but a malformed sequence returns the input unchanged instead of throwing.
    /// Strict UTF-8 validation matches JavaScript, which rejects overlong and surrogate encodings.
    /// </summary>
    public static string DecodeUriComponentOrSelf(string value)
    {
        if (!value.Contains('%', StringComparison.Ordinal)) return value;

        var result = new System.Text.StringBuilder(value.Length);
        var pending = new List<byte>();
        var strict = new System.Text.UTF8Encoding(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);

        bool Flush()
        {
            if (pending.Count == 0) return true;
            try
            {
                result.Append(strict.GetString(pending.ToArray()));
            }
            catch (System.Text.DecoderFallbackException)
            {
                return false;
            }
            pending.Clear();
            return true;
        }

        for (var i = 0; i < value.Length; i++)
        {
            if (value[i] == '%')
            {
                if (i + 2 >= value.Length || !IsHex(value[i + 1]) || !IsHex(value[i + 2])) return value;
                pending.Add((byte)(HexValue(value[i + 1]) * 16 + HexValue(value[i + 2])));
                i += 2;
                continue;
            }
            if (!Flush()) return value;
            result.Append(value[i]);
        }
        return Flush() ? result.ToString() : value;
    }

    internal static bool IsHex(char c) => c is >= '0' and <= '9' or >= 'a' and <= 'f' or >= 'A' and <= 'F';

    internal static int HexValue(char c) => c <= '9' ? c - '0' : (c | 0x20) - 'a' + 10;

    /// <summary>Replaces unpaired surrogates with U+FFFD, like String.prototype.toWellFormed().</summary>
    public static string ToWellFormed(string value) =>
        System.Text.Encoding.UTF8.GetString(System.Text.Encoding.UTF8.GetBytes(value));
}
