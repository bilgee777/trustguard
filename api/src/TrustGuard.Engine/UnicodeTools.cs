using System.Text;
using System.Text.RegularExpressions;

namespace TrustGuard.Engine;

internal static partial class UnicodeTools
{
    /// <summary>Characters that render as nothing but break keyword filters.</summary>
    [GeneratedRegex("[\\u00AD\\u200B-\\u200F\\u2060-\\u2064\\uFEFF]", RegexOptions.CultureInvariant)]
    private static partial Regex InvisibleChars();

    [GeneratedRegex("[\\p{L}\\p{M}]+", RegexOptions.CultureInvariant)]
    private static partial Regex Words();

    public static List<TextSpan> FindInvisibleChars(string text) =>
        InvisibleChars().Matches(text).Select(m => new TextSpan(m.Index, m.Index + m.Length)).ToList();

    /// <summary>
    /// Script detection by explicit code-point ranges, the same table the TypeScript engine uses, so
    /// both classify every character identically.
    /// </summary>
    private static readonly (string Name, int From, int To)[] ScriptRanges =
    [
        ("Latin", 0x41, 0x5A), ("Latin", 0x61, 0x7A), ("Latin", 0xC0, 0x24F), ("Latin", 0x1E00, 0x1EFF),
        ("Greek", 0x370, 0x3FF), ("Greek", 0x1F00, 0x1FFF),
        ("Cyrillic", 0x400, 0x52F),
        ("Armenian", 0x530, 0x58F),
    ];

    private static string? ScriptOf(int codeUnit)
    {
        foreach (var (name, from, to) in ScriptRanges)
        {
            if (codeUnit >= from && codeUnit <= to) return name;
        }
        return null;
    }

    public static bool IsMixedScript(string word)
    {
        var scripts = new HashSet<string>(StringComparer.Ordinal);
        foreach (var c in word)
        {
            var script = ScriptOf(c);
            if (script is not null) scripts.Add(script);
        }
        return scripts.Count > 1 && scripts.Contains("Latin");
    }

    /// <summary>Words that mix Latin with look-alike scripts, e.g. "Pаypal" with a Cyrillic "а".</summary>
    public static List<TextSpan> FindMixedScriptWords(string text) =>
        Words().Matches(text).Where(m => IsMixedScript(m.Value)).Select(m => new TextSpan(m.Index, m.Index + m.Length)).ToList();

    private static readonly Dictionary<int, string> Confusables = BuildConfusables();

    private static Dictionary<int, string> BuildConfusables()
    {
        // Cyrillic, Greek and a few Latin-extended look-alikes, then leetspeak digits.
        const string pairs =
            "а=a е=e о=o р=p с=c у=y х=x і=i ј=j ѕ=s ԁ=d һ=h ӏ=l ԛ=q ԝ=w ο=o α=a ν=v ρ=p τ=t ι=i κ=k ε=e υ=u ı=i ɡ=g ℓ=l " +
            "0=o 1=l 3=e 4=a 5=s 7=t @=a";
        var map = new Dictionary<int, string>();
        foreach (var pair in pairs.Split(' '))
        {
            map[char.ConvertToUtf32(pair, 0)] = pair[^1].ToString();
        }
        return map;
    }

    /// <summary>
    /// Reduces a string to a comparable "skeleton": look-alike letters and digit substitutions map to
    /// the Latin letter they imitate. Inspired by Unicode TS #39, with a deliberately small table so
    /// results stay explainable.
    /// </summary>
    public static string Skeleton(string value)
    {
        var normalized = value.ToLowerInvariant();
        try
        {
            normalized = normalized.Normalize(NormalizationForm.FormKC);
        }
        catch (ArgumentException)
        {
            // Lone surrogates cannot be normalized; JavaScript leaves them as they are.
        }

        var builder = new StringBuilder(normalized.Length);
        foreach (var rune in normalized.EnumerateRunes())
        {
            builder.Append(Confusables.TryGetValue(rune.Value, out var mapped) ? mapped : rune.ToString());
        }
        return builder.ToString().Replace("rn", "m", StringComparison.Ordinal).Replace("vv", "w", StringComparison.Ordinal);
    }

    public static int Levenshtein(string a, string b)
    {
        if (string.Equals(a, b, StringComparison.Ordinal)) return 0;
        var previous = Enumerable.Range(0, b.Length + 1).ToArray();
        for (var i = 1; i <= a.Length; i++)
        {
            var diagonal = previous[0];
            previous[0] = i;
            for (var j = 1; j <= b.Length; j++)
            {
                var above = previous[j];
                var cost = a[i - 1] == b[j - 1] ? 0 : 1;
                previous[j] = Math.Min(Math.Min(above + 1, previous[j - 1] + 1), diagonal + cost);
                diagonal = above;
            }
        }
        return previous[b.Length];
    }
}
