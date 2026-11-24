namespace TrustGuard.Engine;

internal static class Recommendations
{
    private static readonly Dictionary<IndicatorCategory, string[]> ByCategory = new()
    {
        [IndicatorCategory.Phishing] =
        [
            "Do not sign in through links in messages. Open the official app or type the address yourself.",
            "If you already entered a password, change it now and turn on two-factor authentication.",
        ],
        [IndicatorCategory.SuspiciousLink] = ["Do not open the link. If you need to check it, use the URL Inspector here."],
        [IndicatorCategory.SuspiciousDomain] =
        [
            "Compare the domain with the organisation’s real website. Look-alike domains differ by one or two characters.",
        ],
        [IndicatorCategory.Impersonation] =
        [
            "Contact the organisation using a phone number or website you find yourself, not one in the message.",
        ],
        [IndicatorCategory.PersonalInfo] =
        [
            "Never share one-time codes, card details or ID documents in reply to a message.",
            "If you shared card details, call your bank using the number on the back of your card.",
        ],
        [IndicatorCategory.AdvanceFee] = ["Do not pay any fee, deposit or charge. Legitimate jobs, prizes and deliveries do not require one."],
        [IndicatorCategory.FakeJob] = ["Check the company and recruiter on the company’s official careers page before replying."],
        [IndicatorCategory.UnrealisticEarnings] =
        [
            "Treat guaranteed returns as a red flag. Check the firm with your country’s financial regulator.",
        ],
        [IndicatorCategory.Urgency] = ["Slow down. Pressure to act fast is a tactic, and real organisations will give you time."],
        [IndicatorCategory.Obfuscation] = ["Hidden or look-alike characters are a deliberate trick. Treat the whole message as hostile."],
    };

    public static List<Recommendation> Build(IReadOnlyList<Finding> findings, RiskLevel level)
    {
        var items = new List<Recommendation>();
        var seen = new HashSet<string>(StringComparer.Ordinal);

        void Add(string id, string text, RecommendationPriority priority)
        {
            if (!seen.Add(text)) return;
            items.Add(new Recommendation(id, text, priority));
        }

        var urgent = level is RiskLevel.Critical or RiskLevel.High;
        if (urgent) Add("general.no-reply", "Do not reply, click links or call numbers in this message.", RecommendationPriority.Primary);

        // Stable sort by weight, then first appearance of each category.
        var categories = findings.OrderByDescending(f => f.Weight).Select(f => f.Category).Distinct();
        foreach (var category in categories)
        {
            if (!ByCategory.TryGetValue(category, out var texts)) continue;
            for (var index = 0; index < texts.Length; index++)
            {
                Add($"{EngineJson.EnumName(category)}.{index}", texts[index], RecommendationPriority.Secondary);
            }
        }

        if (urgent)
        {
            Add("general.report", "Report the message: forward scam SMS to your carrier’s spam number or use “Report junk” in your email app.", RecommendationPriority.Secondary);
            Add("general.block", "Block the sender and delete the message once you have reported it.", RecommendationPriority.Secondary);
        }
        if (level == RiskLevel.Low)
        {
            Add(
                "general.low",
                "No common scam patterns were found, but a low score is not a guarantee. If the message asks for money or data, confirm through a channel you already trust.",
                RecommendationPriority.Primary);
            return items;
        }

        // At most three primary actions: when everything is highlighted, nothing is.
        var primaryCount = 0;
        return items.Select(r =>
        {
            var priority = primaryCount < 3 ? RecommendationPriority.Primary : RecommendationPriority.Secondary;
            if (priority == RecommendationPriority.Primary) primaryCount++;
            return r with { Priority = priority };
        }).ToList();
    }
}
