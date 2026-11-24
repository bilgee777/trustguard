namespace TrustGuard.Engine;

internal static class Scoring
{
    /// <summary>
    /// Noisy-OR combination: each finding is an independent chance that the content is malicious,
    /// risk = 1 - Π(1 - wᵢ). Adding a finding never lowers the score, the score saturates below 100
    /// instead of overflowing like a plain sum, and one strong signal outweighs many weak ones.
    /// </summary>
    public static int CombineWeights(IEnumerable<double> weights)
    {
        var product = 1.0;
        foreach (var weight in weights)
        {
            var safe = Math.Min(Math.Max(weight, 0), 0.99);
            product *= 1 - safe;
        }
        return JsText.Round((1 - product) * 100);
    }

    public static RiskLevel LevelForScore(int score) => score switch
    {
        >= 75 => RiskLevel.Critical,
        >= 50 => RiskLevel.High,
        >= 25 => RiskLevel.Moderate,
        _ => RiskLevel.Low,
    };

    /// <summary>
    /// Splits the final score into per-finding points that add up exactly to the score. In log space
    /// noisy-OR is additive, -ln(1 - risk) = Σ -ln(1 - wᵢ), so each finding's share of the log-odds is
    /// its fair share of the points. Largest-remainder rounding keeps the integers summing to the score.
    /// </summary>
    public static List<ScoreContribution> AttributeScore(IReadOnlyList<Finding> findings, int score)
    {
        var logs = findings.Select(f => -Math.Log(1 - Math.Min(f.Weight, 0.99))).ToList();
        var total = 0.0;
        foreach (var log in logs) total += log;

        if (total == 0 || score == 0) return findings.Select(f => new ScoreContribution(f.Id, 0)).ToList();

        var raw = logs.Select(l => l / total * score).ToList();
        var floored = raw.Select(Math.Floor).ToArray();
        var remainder = score - (int)floored.Sum();

        // OrderByDescending is a stable sort, matching JavaScript's Array.prototype.sort.
        var order = raw.Select((value, index) => (index, fraction: value - Math.Floor(value))).OrderByDescending(x => x.fraction);
        foreach (var (index, _) in order)
        {
            if (remainder <= 0) break;
            floored[index]++;
            remainder--;
        }
        return findings.Select((f, i) => new ScoreContribution(f.Id, (int)floored[i])).ToList();
    }
}
