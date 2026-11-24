using System.Text.RegularExpressions;

namespace TrustGuard.Engine;

/// <summary>
/// The hybrid-ready, deterministic risk engine. Rule data is shared with the TypeScript engine, and
/// both engines are held to the same golden outputs (shared/engine/parity-expected.json).
/// </summary>
public static class RiskEngine
{
    public const string EngineVersion = "1.0.0";
    public const int MaxInputLength = 10_000;
    private const int MaxUrls = 10;
    private const int MaxEvidence = 3;
    private const double MaxWeight = 0.9;

    private static readonly Regex EmailPattern = JsRegex.Create("[\\p{L}\\p{N}._%+-]+@([\\p{L}\\p{N}-]+(?:\\.[\\p{L}\\p{N}-]+)+)");

    /// <summary>One compiled "brand name in text" pattern per brand, built once.</summary>
    private static readonly List<(Brand Brand, Regex Mention)> BrandMentions = EngineData.Brands
        .Select(brand => (brand, JsRegex.Create($"\\b({string.Join('|', brand.Keywords.Select(CollapseWhitespace))})\\b")))
        .ToList();

    private static string CollapseWhitespace(string keyword)
    {
        var builder = new System.Text.StringBuilder();
        var inGap = false;
        foreach (var c in keyword)
        {
            if (JsText.IsWhitespace(c))
            {
                if (!inGap) builder.Append("\\s+");
                inGap = true;
            }
            else
            {
                builder.Append(c);
                inGap = false;
            }
        }
        return builder.ToString();
    }

    private static List<string> CollectEvidence(string text, IEnumerable<TextSpan> spans)
    {
        var seen = new Dictionary<string, string>(StringComparer.Ordinal);
        var order = new List<string>();
        foreach (var span in spans)
        {
            var snippet = JsText.Trim(text[span.Start..span.End]);
            var key = snippet.ToLowerInvariant();
            if (snippet.Length > 0 && seen.TryAdd(key, snippet)) order.Add(key);
            if (seen.Count >= MaxEvidence) break;
        }
        return order.Select(key => seen[key]).ToList();
    }

    private static List<Finding> RunTextRules(AnalysisInput input)
    {
        var findings = new List<Finding>();
        foreach (var rule in EngineData.Rules)
        {
            var spans = rule.Patterns
                .SelectMany(pattern => pattern.Matches(input.Text).Select(m => new TextSpan(m.Index, m.Index + m.Length)))
                .ToList();
            if (spans.Count == 0) continue;

            var boost = rule.Boost.TryGetValue(input.ContentType, out var factor) ? factor : 1.0;
            findings.Add(new Finding
            {
                Id = rule.Id,
                RuleId = rule.Id,
                Category = rule.Category,
                Title = rule.Title,
                Explanation = rule.Explanation,
                Weight = Math.Min(rule.Weight * boost, MaxWeight),
                Evidence = CollectEvidence(input.Text, spans),
                Spans = spans,
            });
        }
        return findings;
    }

    private static List<Finding> RunObfuscationChecks(string text)
    {
        var findings = new List<Finding>();

        var invisible = UnicodeTools.FindInvisibleChars(text);
        if (invisible.Count > 0)
        {
            var plural = invisible.Count == 1 ? "" : "s";
            findings.Add(new Finding
            {
                Id = "obfuscation.invisible",
                RuleId = "obfuscation.invisible",
                Category = IndicatorCategory.Obfuscation,
                Title = "Invisible characters inside the text",
                Explanation = $"The text contains {invisible.Count} invisible character{plural}. They are inserted to break up words so spam filters miss them.",
                Weight = 0.3,
                Evidence = [$"{invisible.Count} hidden character{plural}"],
                Spans = invisible,
            });
        }

        var mixed = UnicodeTools.FindMixedScriptWords(text);
        if (mixed.Count > 0)
        {
            findings.Add(new Finding
            {
                Id = "obfuscation.mixed_script",
                RuleId = "obfuscation.mixed_script",
                Category = IndicatorCategory.Obfuscation,
                Title = "Words built from look-alike letters",
                Explanation = "Some words mix Latin letters with identical-looking Cyrillic or Greek ones. Real companies never do this. It is used to fake brand names and dodge filters.",
                Weight = 0.4,
                Evidence = CollectEvidence(text, mixed),
                Spans = mixed,
            });
        }
        return findings;
    }

    private static List<ExtractedUrl> LocateUrls(AnalysisInput input)
    {
        if (input.ContentType == ContentType.Url)
        {
            var value = JsText.Trim(input.Text);
            if (value.Length == 0) return [];
            var start = input.Text.IndexOf(value, StringComparison.Ordinal);
            return [new ExtractedUrl(value, start, start + value.Length)];
        }
        return UrlInspector.ExtractUrls(input.Text).Take(MaxUrls).ToList();
    }

    private static Finding WithSpans(Finding source, List<TextSpan> spans) => new()
    {
        Id = source.Id,
        RuleId = source.RuleId,
        Category = source.Category,
        Title = source.Title,
        Explanation = source.Explanation,
        Weight = source.Weight,
        Evidence = [.. source.Evidence],
        Spans = spans,
    };

    /// <summary>URL findings from several links are merged per rule, keeping the strongest weight.</summary>
    private static List<Finding> MergeUrlFindings(IReadOnlyList<ExtractedUrl> located, IReadOnlyList<UrlReport> reports)
    {
        var merged = new Dictionary<string, Finding>(StringComparer.Ordinal);
        var order = new List<string>();
        for (var index = 0; index < reports.Count; index++)
        {
            var span = index < located.Count ? located[index] : null;
            foreach (var finding in reports[index].Findings)
            {
                var spans = span is null ? [] : new List<TextSpan> { new(span.Start, span.End) };
                if (!merged.TryGetValue(finding.RuleId, out var existing))
                {
                    merged[finding.RuleId] = WithSpans(finding, spans);
                    order.Add(finding.RuleId);
                    continue;
                }
                existing.Spans.AddRange(spans);
                existing.Evidence = existing.Evidence.Concat(finding.Evidence).Distinct(StringComparer.Ordinal).Take(MaxEvidence).ToList();
                if (finding.Weight > existing.Weight)
                {
                    existing.Weight = finding.Weight;
                    existing.Title = finding.Title;
                    existing.Explanation = finding.Explanation;
                }
            }
        }
        return order.Select(id => merged[id]).ToList();
    }

    /// <summary>
    /// Sender addresses are excluded from link extraction, but a look-alike sender domain
    /// (service@paypa1-support.com) is one of the strongest phishing signals, so the domain part is
    /// run through the same look-alike checks as links.
    /// </summary>
    private static List<Finding> RunSenderChecks(string text)
    {
        var spans = new List<TextSpan>();
        Finding? strongest = null;
        foreach (Match match in EmailPattern.Matches(text))
        {
            var domain = match.Groups[1].Value;
            var lookalike = UrlInspector.Inspect(domain).Findings
                .FirstOrDefault(f => f.RuleId is "url.brand-lookalike" or "url.punycode");
            if (lookalike is null) continue;

            var start = match.Index + match.Length - domain.Length;
            spans.Add(new TextSpan(start, start + domain.Length));
            strongest ??= new Finding
            {
                Id = "sender.lookalike",
                RuleId = "sender.lookalike",
                Category = IndicatorCategory.Impersonation,
                Title = $"Sender address: {JsText.LowerFirst(lookalike.Title)}",
                Explanation = $"The message comes from an address at {domain}. {lookalike.Explanation} Display names are free to fake, so the domain after \"@\" is what counts.",
                Weight = 0.5,
                Evidence = [domain],
                Spans = [],
            };
        }
        if (strongest is null) return [];
        strongest.Spans.AddRange(spans);
        return [strongest];
    }

    private static bool Overlaps(TextSpan span, IEnumerable<ExtractedUrl> others) =>
        others.Any(o => span.Start < o.End && o.Start < span.End);

    private static Finding? DetectImpersonation(string text, IReadOnlyList<ExtractedUrl> located, IReadOnlyList<UrlReport> reports, IReadOnlyList<Finding> findings)
    {
        var asksForData = findings.Any(f => f.Category is IndicatorCategory.Phishing or IndicatorCategory.PersonalInfo or IndicatorCategory.AdvanceFee);
        foreach (var (brand, pattern) in BrandMentions)
        {
            var mentions = pattern.Matches(text)
                .Select(m => new TextSpan(m.Index, m.Index + m.Length))
                .Where(span => !Overlaps(span, located))
                .ToList();
            if (mentions.Count == 0) continue;

            var foreignHosts = reports
                .Where(r => r.Parts is { Scheme: "http" or "https" })
                .Select(r => r.Parts!.Host)
                .Where(host => !EngineData.IsOfficialHost(host, brand))
                .ToList();
            if (foreignHosts.Count == 0 && !asksForData) continue;

            var explanation = foreignHosts.Count > 0
                ? $"The message presents itself as {brand.Name}, but its link goes to {foreignHosts[0]}, which is not one of {brand.Name}'s official domains ({string.Join(", ", brand.Domains)})."
                : $"The message presents itself as {brand.Name} and asks for an action, payment or data. {brand.Name} will not ask for this by message. Check in the official app instead.";
            return new Finding
            {
                Id = "impersonation.brand",
                RuleId = "impersonation.brand",
                Category = IndicatorCategory.Impersonation,
                Title = $"Claims to be {brand.Name}",
                Explanation = explanation,
                Weight = foreignHosts.Count > 0 ? 0.4 : 0.25,
                Evidence = CollectEvidence(text, mentions),
                Spans = mentions,
            };
        }
        return null;
    }

    private static List<Finding> DetectCombinations(IReadOnlyList<Finding> findings, IReadOnlyList<UrlReport> reports)
    {
        bool Has(IndicatorCategory category) => findings.Any(f => f.Category == category);
        var riskyLink = reports.Any(r => r.Valid && r.OfficialBrand is null);
        var combos = new List<Finding>();

        void Combo(string id, IndicatorCategory category, string title, string explanation, double weight) =>
            combos.Add(new Finding { Id = id, RuleId = id, Category = category, Title = title, Explanation = explanation, Weight = weight, Evidence = [], Spans = [] });

        if (Has(IndicatorCategory.Urgency) && riskyLink)
        {
            Combo(
                "combo.pressure_link", IndicatorCategory.SuspiciousLink, "Pressure combined with a link",
                "Urgent or threatening wording next to a link is the core phishing recipe: it makes you click before you check where the link goes.",
                0.15);
        }
        if (Has(IndicatorCategory.FakeJob) && Has(IndicatorCategory.AdvanceFee))
        {
            Combo(
                "combo.job_fee", IndicatorCategory.AdvanceFee, "Job offer that asks you to pay",
                "Real employers pay you. They never charge for training, equipment, registration or a “starter kit”.",
                0.35);
        }
        if (Has(IndicatorCategory.UnrealisticEarnings) && findings.Any(f => f.RuleId == "advance_fee.untraceable"))
        {
            Combo(
                "combo.investment_fraud", IndicatorCategory.UnrealisticEarnings, "Promised returns paid in untraceable money",
                "High or guaranteed returns combined with a request to send crypto, gift cards or wire transfers is the signature of investment fraud. Deposits are almost never recovered.",
                0.3);
        }
        if (findings.Any(f => f.RuleId == "phishing.credentials") && riskyLink)
        {
            Combo(
                "combo.credential_link", IndicatorCategory.Phishing, "Account request with an unofficial link",
                "The message asks you to act on your account and supplies a link that is not an official domain of a known brand.",
                0.2);
        }
        return combos;
    }

    /// <summary>
    /// Normalizes line endings (regex "." treats \r differently in JavaScript and .NET), clips to the
    /// maximum length, and replaces unpaired surrogates, which would otherwise make the text
    /// impossible to encode as JSON or UTF-8.
    /// </summary>
    internal static string NormalizeText(string text)
    {
        var normalized = text.Replace("\r\n", "\n", StringComparison.Ordinal).Replace('\r', '\n');
        if (normalized.Length > MaxInputLength) normalized = normalized[..MaxInputLength];
        return JsText.ToWellFormed(normalized);
    }

    public static AnalysisResult Analyze(AnalysisInput input, AnalyzeOptions? options = null)
    {
        options ??= new AnalyzeOptions();
        var text = NormalizeText(input.Text);
        var normalized = input with { Text = text };

        var located = LocateUrls(normalized);
        var reports = located.Select(u => UrlInspector.Inspect(u.Value)).ToList();

        var findings = new List<Finding>();
        findings.AddRange(RunTextRules(normalized));
        findings.AddRange(RunObfuscationChecks(text));
        findings.AddRange(MergeUrlFindings(located, reports));
        findings.AddRange(RunSenderChecks(text));

        var impersonation = DetectImpersonation(text, located, reports, findings);
        if (impersonation is not null) findings.Add(impersonation);
        findings.AddRange(DetectCombinations(findings, reports));

        var score = Scoring.CombineWeights(findings.Select(f => f.Weight));
        var level = Scoring.LevelForScore(score);
        var points = Scoring.AttributeScore(findings, score).ToDictionary(c => c.FindingId, c => c.Points, StringComparer.Ordinal);

        // OrderBy/ThenBy are stable, like JavaScript's sort, so ties keep their original order.
        var sorted = findings.OrderByDescending(f => points[f.Id]).ThenByDescending(f => f.Weight).ToList();

        var byCategory = new Dictionary<IndicatorCategory, (int Points, List<string> Ids)>();
        var categoryOrder = new List<IndicatorCategory>();
        foreach (var finding in sorted)
        {
            if (!byCategory.TryGetValue(finding.Category, out var entry))
            {
                entry = (0, []);
                categoryOrder.Add(finding.Category);
            }
            entry.Ids.Add(finding.Id);
            byCategory[finding.Category] = (entry.Points + points[finding.Id], entry.Ids);
        }

        return new AnalysisResult(
            options.Id ?? Guid.NewGuid().ToString(),
            options.Now ?? DateTimeOffset.UtcNow,
            EngineVersion,
            options.Source,
            options.DemoScenarioId,
            input.ContentType,
            text,
            score,
            level,
            ConfidenceAssessor.Assess(text, sorted, score),
            sorted,
            sorted.Select(f => new ScoreContribution(f.Id, points[f.Id])).ToList(),
            categoryOrder.Select(c => new CategoryBreakdown(c, byCategory[c].Points, byCategory[c].Ids)).OrderByDescending(c => c.Points).ToList(),
            Highlights.Build(text, sorted),
            Recommendations.Build(sorted, level),
            reports,
            null);
    }
}
