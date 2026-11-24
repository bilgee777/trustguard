namespace TrustGuard.Engine;

internal static class ConfidenceAssessor
{
    /// <summary>
    /// Confidence describes how much evidence the engine had, not how dangerous the content is. A long
    /// message with several independent signals pointing the same way is high confidence; a short
    /// message with no signals is low confidence even though it scores 0.
    /// </summary>
    public static Confidence Assess(string text, IReadOnlyList<Finding> findings, int score)
    {
        var words = JsText.CountWords(text);
        var categories = findings.Select(f => f.Category).Distinct().Count();
        var strongSignals = findings.Count(f => f.Weight >= 0.45);
        var reasons = new List<string>();
        var value = 55;

        if (words < 8)
        {
            value -= 25;
            reasons.Add("Very short text gives the engine little to work with.");
        }
        else if (words >= 30)
        {
            value += 10;
            reasons.Add("Enough text to evaluate wording and context.");
        }

        if (score >= 50)
        {
            value += Math.Min(categories * 8, 24);
            if (categories >= 2) reasons.Add($"{categories} independent indicator types point the same way.");
        }
        if (strongSignals > 0)
        {
            value += 10;
            reasons.Add("At least one strong, specific indicator was found.");
        }
        if (score is >= 25 and < 50)
        {
            value -= 10;
            reasons.Add("Mixed signals: some warning signs, but none decisive.");
        }
        if (score < 25 && findings.Count == 0 && words >= 8)
        {
            reasons.Add("No known scam patterns matched. New or tailored scams can still slip through.");
        }

        reasons.Add("Rule-based analysis only. AI review is not connected in this version.");
        value = Math.Min(Math.Max(value, 5), 85);
        var level = value >= 70 ? ConfidenceLevel.High : value >= 45 ? ConfidenceLevel.Medium : ConfidenceLevel.Low;
        return new Confidence(level, value, reasons);
    }
}
