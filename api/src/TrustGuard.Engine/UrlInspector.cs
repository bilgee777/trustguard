using System.Text.RegularExpressions;

namespace TrustGuard.Engine;

public sealed record ExtractedUrl(string Value, int Start, int End);

/// <summary>
/// Structural URL analysis. Links are taken apart as text and are never fetched, so inspecting a
/// malicious link cannot confirm to its owner that the message was read.
/// </summary>
public static class UrlInspector
{
    private sealed record FindingSpec(IndicatorCategory Category, string Title, double Weight);

    private sealed record CheckSpec(string Id, string Label, UrlCheckStatus Status, string Detail, FindingSpec? Finding = null);

    private static readonly HashSet<string> DangerousSchemes = new(["javascript", "data", "vbscript", "file"], StringComparer.Ordinal);

    private static readonly Regex SensitiveWords = JsRegex.Create(
        "(log-?in|sign-?in|verify|verification|secure|account|update|unlock|confirm|billing|password|wallet|suspend|restore)");

    private const int MaxUrlLength = 2048;

    // ---- text helpers ------------------------------------------------------------------------------

    /// <summary>Length of a leading "scheme" token ([a-z][a-z0-9+.-]*), or 0.</summary>
    private static int SchemeTokenLength(string value)
    {
        if (value.Length == 0 || !JsText.IsAsciiLetter(value[0])) return 0;
        var length = 1;
        while (length < value.Length && (JsText.IsAsciiLetter(value[length]) || JsText.IsAsciiDigit(value[length]) || value[length] is '+' or '-' or '.')) length++;
        return length;
    }

    private static bool HasExplicitScheme(string value)
    {
        var length = SchemeTokenLength(value);
        if (length > 0 && value[length..].StartsWith("://", StringComparison.Ordinal)) return true;
        foreach (var scheme in new[] { "javascript:", "data:", "vbscript:", "file:", "mailto:", "tel:" })
        {
            if (value.StartsWith(scheme, StringComparison.OrdinalIgnoreCase)) return true;
        }
        return false;
    }

    /// <summary>Makes a URL safe to display and copy: it can no longer be clicked or auto-linked.</summary>
    public static string Defang(string value)
    {
        var length = SchemeTokenLength(value);
        var hasScheme = length > 0 && value[length..].StartsWith("://", StringComparison.Ordinal);
        var scheme = hasScheme ? value[..length] : "";
        var rest = hasScheme ? value[(length + 3)..] : value;

        var slash = rest.IndexOfAny(['/', '?', '#']);
        var authority = slash < 0 ? rest : rest[..slash];
        var tail = slash < 0 ? "" : rest[slash..];

        var safeScheme = scheme.Length == 0
            ? ""
            : (scheme.StartsWith("http", StringComparison.OrdinalIgnoreCase) ? "hxxp" + scheme[4..] : scheme) + "://";
        return safeScheme + authority.Replace(".", "[.]", StringComparison.Ordinal) + tail;
    }

    private static string RawHost(string input)
    {
        var letters = 0;
        while (letters < input.Length && JsText.IsAsciiLetter(input[letters])) letters++;
        if (letters > 0 && input[letters..].StartsWith("://", StringComparison.Ordinal))
        {
            var afterScheme = input[(letters + 3)..];
            var end = afterScheme.IndexOfAny(['/', '?', '#']);
            var host = end < 0 ? afterScheme : afterScheme[..end];
            if (host.Length > 0) return host;
        }
        var cut = input.IndexOfAny(['/', '?', '#']);
        return cut < 0 ? input : input[..cut];
    }

    private static string LastLabels(string host, int count)
    {
        var labels = host.Split('.');
        return labels.Length <= count ? host : string.Join('.', labels[^count..]);
    }

    private static UrlReport Invalid(string input, string detail) =>
        new(input, Defang(input), false, null, [new UrlCheck("parse", "Valid address", UrlCheckStatus.Warn, detail)], [], 0, RiskLevel.Low, null);

    // ---- brand look-alikes -------------------------------------------------------------------------

    private static CheckSpec? BrandLookalike(string name, string subdomain, string host)
    {
        var nameSkeleton = UnicodeTools.Skeleton(name);
        var nameTokens = name.Split('-');
        var subLabels = subdomain.Split(['.', '-']).Where(l => l.Length > 0).ToList();

        foreach (var (brand, token) in EngineData.BrandTokens)
        {
            if (name == token) continue;

            CheckSpec Imitates(string detail, string title, double weight) =>
                new("brand-lookalike", "Brand look-alike", UrlCheckStatus.Fail, detail, new FindingSpec(IndicatorCategory.SuspiciousDomain, title, weight));

            if (nameSkeleton == token)
            {
                return Imitates(
                    $"\"{name}\" is built from characters that imitate \"{token}\", but this is not {brand.Name}'s official domain ({string.Join(", ", brand.Domains)}).",
                    $"Look-alike of {brand.Name}",
                    0.6);
            }
            if (token.Length >= 6)
            {
                var distance = UnicodeTools.Levenshtein(nameSkeleton, token);
                if (distance > 0 && distance <= (token.Length >= 7 ? 2 : 1))
                {
                    return Imitates(
                        $"\"{name}\" is one or two characters away from \"{token}\". Typo-squatted domains like this are registered to catch people who don't read addresses closely.",
                        $"Misspelling of {brand.Name}",
                        0.5);
                }
            }
            // Prefix/suffix only, and only for longer tokens: "paypalsecure" is suspicious,
            // but "purchase" must not match "chase" and "pineapple" must not match "apple".
            var inName = nameTokens.Contains(token, StringComparer.Ordinal)
                || (token.Length >= 6 && (nameSkeleton.StartsWith(token, StringComparison.Ordinal) || nameSkeleton.EndsWith(token, StringComparison.Ordinal)));
            if (inName)
            {
                return Imitates(
                    $"The domain contains \"{token}\", but it is registered as {LastLabels(host, 2)}, not by {brand.Name}. Anyone can register a domain that contains a brand name.",
                    $"Uses {brand.Name}'s name in a different domain",
                    0.5);
            }
            if (subLabels.Any(label => UnicodeTools.Skeleton(label) == token))
            {
                return Imitates(
                    $"\"{token}\" appears only in the subdomain. The part that decides who owns the site is the registrable domain at the end of the host.",
                    $"{brand.Name} name placed in a subdomain",
                    0.5);
            }
        }
        return null;
    }

    // ---- inspection --------------------------------------------------------------------------------

    public static UrlReport Inspect(string rawInput)
    {
        var input = JsText.Trim(rawInput);
        if (input.Length == 0) return Invalid(input, "Enter a URL to inspect.");
        if (input.Length > MaxUrlLength) return Invalid(input, $"URLs longer than {MaxUrlLength} characters are not inspected.");

        var schemeProvided = HasExplicitScheme(input);
        var url = WhatwgUrl.Parse(schemeProvided ? input : "https://" + input);
        if (url is null) return Invalid(input, "This is not a well-formed web address.");

        var scheme = url.Scheme;
        var checks = new List<CheckSpec>();

        if (DangerousSchemes.Contains(scheme))
        {
            checks.Add(new CheckSpec(
                "scheme", "Protocol", UrlCheckStatus.Fail,
                $"\"{scheme}:\" links can run code or load embedded content instead of opening a website.",
                new FindingSpec(IndicatorCategory.SuspiciousLink, $"Dangerous \"{scheme}:\" link", 0.7)));
        }
        if (scheme is not ("http" or "https"))
        {
            if (!DangerousSchemes.Contains(scheme))
            {
                checks.Add(new CheckSpec("scheme", "Protocol", UrlCheckStatus.Info, $"\"{scheme}:\" is not a website link."));
            }
            return Finalize(input, url, scheme, null, checks, null);
        }

        var host = url.Hostname.ToLowerInvariant();
        var unicodeHost = Punycode.HostToUnicode(host);
        var split = DomainTools.SplitDomain(unicodeHost);
        var officialBrand = EngineData.FindOfficialBrand(host);

        if (!schemeProvided)
        {
            checks.Add(new CheckSpec("scheme", "HTTPS", UrlCheckStatus.Info, "No protocol was given, so we cannot tell whether the link uses HTTPS."));
        }
        else if (scheme == "http")
        {
            checks.Add(new CheckSpec(
                "scheme", "HTTPS", UrlCheckStatus.Warn,
                "The link uses unencrypted HTTP. Legitimate login and payment pages always use HTTPS.",
                new FindingSpec(IndicatorCategory.SuspiciousLink, "Unencrypted HTTP link", 0.15)));
        }
        else
        {
            checks.Add(new CheckSpec("scheme", "HTTPS", UrlCheckStatus.Pass, "Uses HTTPS. This only means the connection is encrypted. Most phishing sites use HTTPS too."));
        }

        if (url.Username.Length > 0 || url.Password.Length > 0)
        {
            var decoy = UnicodeTools.Skeleton(JsText.DecodeUriComponentOrSelf(url.Username));
            var borrowed = EngineData.BrandTokens.FirstOrDefault(t => decoy.Contains(t.Token, StringComparison.Ordinal))?.Brand;
            var decoration = borrowed is not null ? $", so \"{borrowed.Name}\" there is only decoration" : "";
            checks.Add(new CheckSpec(
                "userinfo", "Hidden destination", UrlCheckStatus.Fail,
                $"Everything before \"@\" is ignored by the browser{decoration}. This link really opens {host}.",
                new FindingSpec(IndicatorCategory.SuspiciousLink, "Text before \"@\" disguises the real site", 0.45)));
        }

        var ipv4 = DomainTools.ParseIPv4(host);
        var isIPv6 = host.StartsWith('[');
        if (ipv4 is not null || isIPv6)
        {
            var nonPublic = ipv4 is not null ? DomainTools.IsNonPublicIPv4(ipv4) : DomainTools.IsNonPublicIPv6(host);
            var rawHost = RawHost(input);
            var obfuscated = ipv4 is not null
                && !rawHost.EndsWith(host, StringComparison.Ordinal)
                && !rawHost.Contains($"@{host}", StringComparison.Ordinal);

            var detail = nonPublic
                ? "The link points to a private or internal network address. A message from outside should never send you there."
                : obfuscated
                    ? $"The address is written in an unusual numeric form that browsers convert to {host}. This is a common filter-evasion trick."
                    : "The link uses a raw IP address instead of a domain name, which hides who operates the site.";
            var title = nonPublic
                ? "Link to a private network address"
                : obfuscated ? "Disguised IP address" : "Raw IP address instead of a domain";
            checks.Add(new CheckSpec(
                "ip-host", "Domain name", UrlCheckStatus.Fail, detail,
                new FindingSpec(IndicatorCategory.SuspiciousDomain, title, obfuscated || nonPublic ? 0.5 : 0.35)));
            return Finalize(input, url, scheme, unicodeHost, checks, null);
        }

        if (EngineData.UrlShorteners.Contains(host))
        {
            checks.Add(new CheckSpec(
                "shortener", "URL shortener", UrlCheckStatus.Warn,
                $"{host} is a link shortener. The real destination is hidden until you open it.",
                new FindingSpec(IndicatorCategory.SuspiciousLink, "Shortened link hides the destination", 0.2)));
        }

        if (host.Split('.').Any(label => label.StartsWith("xn--", StringComparison.Ordinal)))
        {
            var mixed = unicodeHost.Split('.').Any(UnicodeTools.IsMixedScript);
            checks.Add(new CheckSpec(
                "punycode", "International characters", mixed ? UrlCheckStatus.Fail : UrlCheckStatus.Warn,
                mixed
                    ? $"The domain displays as \"{unicodeHost}\" and mixes alphabets. Letters from other alphabets can look identical to Latin ones."
                    : $"The domain uses non-Latin characters and displays as \"{unicodeHost}\". That is normal for some languages, but it is also used to imitate familiar names.",
                mixed
                    ? new FindingSpec(IndicatorCategory.Obfuscation, "Domain mixes look-alike alphabets", 0.45)
                    : new FindingSpec(IndicatorCategory.SuspiciousDomain, "Internationalized (punycode) domain", 0.2)));
        }

        if (officialBrand is not null)
        {
            checks.Add(new CheckSpec(
                "brand-lookalike", "Brand look-alike", UrlCheckStatus.Pass,
                $"{split.Registrable} is a known official domain of {officialBrand.Name}. That does not make the message itself trustworthy."));
        }
        else
        {
            checks.Add(BrandLookalike(split.Name, split.Subdomain, host)
                ?? new CheckSpec("brand-lookalike", "Brand look-alike", UrlCheckStatus.Pass, "Does not imitate any of the brands we track."));
        }

        var tld = split.Suffix.Split('.')[^1];
        if (EngineData.HighAbuseTldSet.Contains(tld))
        {
            checks.Add(new CheckSpec(
                "tld", "Domain ending", UrlCheckStatus.Warn,
                $"\".{tld}\" domains are cheap to register and show up often in abuse reports. Many are legitimate, so this is a weak signal on its own.",
                new FindingSpec(IndicatorCategory.SuspiciousDomain, $"High-abuse \".{tld}\" domain ending", 0.15)));
        }

        var subdomainDepth = split.Subdomain.Length > 0 ? split.Subdomain.Split('.').Length : 0;
        if (subdomainDepth >= 3)
        {
            checks.Add(new CheckSpec(
                "subdomains", "Subdomain depth", UrlCheckStatus.Warn,
                $"The address has {subdomainDepth} subdomain levels. Long chains push the real domain out of view on small screens.",
                new FindingSpec(IndicatorCategory.SuspiciousDomain, "Unusually deep subdomain chain", 0.15)));
        }

        if (split.Name.Count(c => c == '-') >= 2)
        {
            checks.Add(new CheckSpec(
                "hyphens", "Domain structure", UrlCheckStatus.Warn,
                $"\"{split.Registrable}\" strings several words together with hyphens, a pattern common in throwaway phishing domains.",
                new FindingSpec(IndicatorCategory.SuspiciousDomain, "Hyphen-heavy domain name", 0.1)));
        }

        if (url.Port.Length > 0)
        {
            checks.Add(new CheckSpec(
                "port", "Port", UrlCheckStatus.Warn,
                $"The link uses port {url.Port}. Public websites rarely need a custom port.",
                new FindingSpec(IndicatorCategory.SuspiciousLink, "Non-standard port", 0.1)));
        }

        if (officialBrand is null)
        {
            var match = SensitiveWords.Match(host + url.Pathname);
            if (match.Success)
            {
                checks.Add(new CheckSpec(
                    "sensitive-path", "Account wording", UrlCheckStatus.Warn,
                    $"The address contains \"{match.Value}\". Phishing pages use account and login wording to look official.",
                    new FindingSpec(IndicatorCategory.Phishing, "Login or account wording in the address", 0.12)));
            }
        }

        if (input.Length > 120)
        {
            checks.Add(new CheckSpec(
                "length", "Length", UrlCheckStatus.Info,
                $"The link is {input.Length} characters long. Long links make it harder to see where they lead."));
        }

        return Finalize(input, url, scheme, unicodeHost, checks, officialBrand);
    }

    private static UrlReport Finalize(string input, ParsedUrl url, string scheme, string? unicodeHost, List<CheckSpec> specs, Brand? officialBrand)
    {
        var host = url.Hostname.ToLowerInvariant();
        // Ownership is reported in the ASCII (punycode) form: that is the name actually registered.
        // The Unicode form is what an attacker wants you to see, so it is only shown as a display hint.
        var split = DomainTools.SplitDomain(host);
        var defanged = Defang(input);

        var findings = specs
            .Where(spec => spec.Finding is not null)
            .Select(spec => new Finding
            {
                Id = $"url.{spec.Id}",
                RuleId = $"url.{spec.Id}",
                Category = spec.Finding!.Category,
                Title = spec.Finding.Title,
                Explanation = spec.Detail,
                Weight = spec.Finding.Weight,
                Evidence = [defanged],
                Spans = [],
            })
            .ToList();

        var score = Scoring.CombineWeights(findings.Select(f => f.Weight));
        return new UrlReport(
            input,
            defanged,
            true,
            new UrlParts(
                scheme,
                url.Username.Length > 0 ? url.Username : null,
                host,
                unicodeHost ?? host,
                split.Registrable,
                split.Subdomain,
                url.Port.Length > 0 ? url.Port : null,
                url.Pathname,
                url.Search),
            specs.Select(s => new UrlCheck(s.Id, s.Label, s.Status, s.Detail)).ToList(),
            findings,
            score,
            Scoring.LevelForScore(score),
            officialBrand?.Name);
    }

    // ---- extraction --------------------------------------------------------------------------------

    private static readonly Regex UrlPattern = JsRegex.Create(
        "(?:(?:https?|javascript|data):[^\\s<>\"'\\x60]+|www\\.[^\\s<>\"'\\x60]+|(?<![@\\p{L}\\p{N}.-])(?:[\\p{L}\\p{N}-]+\\.)+(?:"
        + string.Join('|', EngineData.BareDomainTlds.Concat(EngineData.HighAbuseTlds))
        + ")(?![\\p{L}\\p{N}-])(?::\\d{2,5})?(?:[/?#][^\\s<>\"'\\x60]*)?)");

    private const string TrailingPunctuation = ".,;:!?)]}'\"";

    public static IReadOnlyList<ExtractedUrl> ExtractUrls(string text)
    {
        var results = new List<ExtractedUrl>();
        foreach (Match match in UrlPattern.Matches(text))
        {
            var value = match.Value.TrimEnd(TrailingPunctuation.ToCharArray());
            if (value.Length < 4) continue;
            results.Add(new ExtractedUrl(value, match.Index, match.Index + value.Length));
        }
        return results;
    }
}
