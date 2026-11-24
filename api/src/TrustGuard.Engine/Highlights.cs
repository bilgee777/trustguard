namespace TrustGuard.Engine;

internal static class Highlights
{
    private sealed class Segment(int start, int end, string text, List<string> findingIds)
    {
        public int Start { get; } = start;
        public int End { get; set; } = end;
        public string Text { get; set; } = text;
        public List<string> FindingIds { get; } = findingIds;
    }

    /// <summary>
    /// Turns overlapping finding spans into a flat, gap-free list of segments covering the whole text.
    /// Each segment lists every finding that covers it, so the UI can render plain text with
    /// highlight elements and no HTML injection risk.
    /// </summary>
    public static List<HighlightSegment> Build(string text, IReadOnlyList<Finding> findings)
    {
        var spans = findings
            .SelectMany(f => f.Spans.Where(s => s.End > s.Start).Select(s => (s.Start, s.End, FindingId: f.Id)))
            .ToList();

        var boundaries = new SortedSet<int> { 0, text.Length };
        foreach (var (start, end, _) in spans)
        {
            boundaries.Add(start);
            boundaries.Add(end);
        }
        var ordered = boundaries.Where(b => b >= 0 && b <= text.Length).ToList();

        var segments = new List<Segment>();
        for (var i = 0; i < ordered.Count - 1; i++)
        {
            var start = ordered[i];
            var end = ordered[i + 1];
            var ids = spans.Where(s => s.Start <= start && s.End >= end).Select(s => s.FindingId).Distinct(StringComparer.Ordinal).ToList();

            var previous = segments.Count > 0 ? segments[^1] : null;
            if (previous is not null && SameIds(previous.FindingIds, ids))
            {
                previous.End = end;
                previous.Text = text[previous.Start..end];
            }
            else
            {
                segments.Add(new Segment(start, end, text[start..end], ids));
            }
        }
        return segments.Select(s => new HighlightSegment(s.Start, s.End, s.Text, s.FindingIds)).ToList();
    }

    private static bool SameIds(List<string> a, List<string> b) => a.Count == b.Count && a.All(id => b.Contains(id, StringComparer.Ordinal));
}
