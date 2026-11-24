using System.Text;
using System.Text.RegularExpressions;

namespace TrustGuard.Engine;

/// <summary>
/// Compiles the JavaScript regular expressions in shared/engine/rules.json so they match exactly
/// what they match in the browser. Three escapes mean different things in .NET:
/// <list type="bullet">
/// <item>\b, \w and \d are Unicode-aware in .NET but ASCII-only in JavaScript, so "verify" next to a
/// Turkish letter would be a different match in the two engines.</item>
/// <item>\s covers a different whitespace set (JavaScript includes U+FEFF).</item>
/// <item>"." excludes only \n in .NET but also \r, U+2028 and U+2029 in JavaScript.</item>
/// </list>
/// Unsupported constructs (\S, \W, \D, \B) throw at startup rather than silently mis-matching.
/// </summary>
internal static class JsRegex
{
    private const string WhitespaceClass =
        "\\t\\n\\u000B\\f\\r \\u00A0\\u1680\\u2000-\\u200A\\u2028\\u2029\\u202F\\u205F\\u3000\\uFEFF";

    private const string WordBoundary =
        "(?:(?<=[A-Za-z0-9_])(?![A-Za-z0-9_])|(?<![A-Za-z0-9_])(?=[A-Za-z0-9_]))";

    /// <summary>Hard cap so pathological input cannot pin a CPU core (ReDoS protection).</summary>
    public static readonly TimeSpan MatchTimeout = TimeSpan.FromSeconds(2);

    public static Regex Create(string jsPattern) =>
        new(Translate(jsPattern), RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, MatchTimeout);

    public static string Translate(string pattern)
    {
        var result = new StringBuilder(pattern.Length + 32);
        var inClass = false;

        for (var i = 0; i < pattern.Length; i++)
        {
            var c = pattern[i];

            if (c == '\\' && i + 1 < pattern.Length)
            {
                var next = pattern[++i];
                switch (next)
                {
                    case 'b' when !inClass:
                        result.Append(WordBoundary);
                        break;
                    case 'd':
                        result.Append(inClass ? "0-9" : "[0-9]");
                        break;
                    case 's':
                        result.Append(inClass ? WhitespaceClass : $"[{WhitespaceClass}]");
                        break;
                    case 'w':
                        result.Append(inClass ? "A-Za-z0-9_" : "[A-Za-z0-9_]");
                        break;
                    case 'D' or 'S' or 'W' or 'B':
                        throw new NotSupportedException($"Regex escape \\{next} has no exact .NET equivalent: {pattern}");
                    default:
                        result.Append('\\').Append(next);
                        break;
                }
                continue;
            }

            if (inClass)
            {
                if (c == ']') inClass = false;
                result.Append(c);
                continue;
            }

            switch (c)
            {
                case '[':
                    inClass = true;
                    result.Append(c);
                    break;
                case '.':
                    result.Append("[^\\n\\r\\u2028\\u2029]");
                    break;
                default:
                    result.Append(c);
                    break;
            }
        }

        return result.ToString();
    }
}
