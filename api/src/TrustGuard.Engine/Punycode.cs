using System.Text;

namespace TrustGuard.Engine;

/// <summary>RFC 3492 Punycode. Decoding reveals what a user sees in the address bar; encoding is used to build ASCII hosts.</summary>
internal static class Punycode
{
    private const int Base = 36;
    private const int TMin = 1;
    private const int TMax = 26;
    private const int Skew = 38;
    private const int Damp = 700;
    private const int InitialBias = 72;
    private const int InitialN = 128;
    private const long MaxInt = 0x7FFFFFFF;

    private static long Adapt(long delta, long numPoints, bool firstTime)
    {
        var d = firstTime ? delta / Damp : delta >> 1;
        d += d / numPoints;
        long k = 0;
        while (d > ((Base - TMin) * TMax) >> 1)
        {
            d /= Base - TMin;
            k += Base;
        }
        return k + ((Base - TMin + 1) * d / (d + Skew));
    }

    private static int DigitOf(char c) => c switch
    {
        >= '0' and <= '9' => c - 22,
        >= 'A' and <= 'Z' => c - 'A',
        >= 'a' and <= 'z' => c - 'a',
        _ => Base,
    };

    /// <summary>Decodes one label (without the "xn--" prefix). Returns null for malformed or out-of-range input.</summary>
    public static string? DecodeLabel(string input)
    {
        var output = new List<int>();
        long i = 0;
        long n = InitialN;
        long bias = InitialBias;
        var basicEnd = Math.Max(input.LastIndexOf('-'), 0);

        for (var j = 0; j < basicEnd; j++)
        {
            if (input[j] >= 0x80) return null;
            output.Add(input[j]);
        }

        for (var index = basicEnd > 0 ? basicEnd + 1 : 0; index < input.Length;)
        {
            var oldI = i;
            long w = 1;
            for (var k = Base; ; k += Base)
            {
                if (index >= input.Length) return null;
                long digit = DigitOf(input[index++]);
                if (digit >= Base || digit > (MaxInt - i) / w) return null;
                i += digit * w;
                var t = k <= bias ? TMin : k >= bias + TMax ? TMax : k - bias;
                if (digit < t) break;
                if (w > MaxInt / (Base - t)) return null;
                w *= Base - t;
            }
            long length = output.Count + 1;
            bias = Adapt(i - oldI, length, oldI == 0);
            if (i / length > MaxInt - n) return null;
            n += i / length;
            i %= length;
            if (n > 0x10FFFF || (n >= 0xD800 && n <= 0xDFFF)) return null;
            output.Insert((int)i++, (int)n);
        }

        var builder = new StringBuilder();
        foreach (var codePoint in output) builder.Append(char.ConvertFromUtf32(codePoint));
        return builder.ToString();
    }

    public static string HostToUnicode(string host) =>
        string.Join('.', host.Split('.').Select(label =>
            label.StartsWith("xn--", StringComparison.OrdinalIgnoreCase) ? DecodeLabel(label[4..]) ?? label : label));

    private static char DigitToChar(long digit) => (char)(digit < 26 ? 'a' + digit : '0' + (digit - 26));

    /// <summary>Encodes one Unicode label (without the "xn--" prefix). Returns null on overflow.</summary>
    public static string? EncodeLabel(string label)
    {
        var codePoints = label.EnumerateRunes().Select(r => r.Value).ToList();
        var output = new StringBuilder();
        foreach (var cp in codePoints.Where(cp => cp < 0x80)) output.Append((char)cp);

        long basicCount = output.Length;
        long handled = basicCount;
        if (basicCount > 0) output.Append('-');

        long n = InitialN;
        long delta = 0;
        long bias = InitialBias;

        while (handled < codePoints.Count)
        {
            var m = codePoints.Where(cp => cp >= n).Min();
            if ((m - n) > (MaxInt - delta) / (handled + 1)) return null;
            delta += (m - n) * (handled + 1);
            n = m;

            foreach (var cp in codePoints)
            {
                if (cp < n && ++delta > MaxInt) return null;
                if (cp != n) continue;

                var q = delta;
                for (var k = Base; ; k += Base)
                {
                    var t = k <= bias ? TMin : k >= bias + TMax ? TMax : k - bias;
                    if (q < t) break;
                    output.Append(DigitToChar(t + ((q - t) % (Base - t))));
                    q = (q - t) / (Base - t);
                }
                output.Append(DigitToChar(q));
                bias = Adapt(delta, handled + 1, handled == basicCount);
                delta = 0;
                handled++;
            }
            delta++;
            n++;
        }
        return output.ToString();
    }
}
