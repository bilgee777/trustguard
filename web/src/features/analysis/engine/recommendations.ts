import type { Finding, IndicatorCategory, Recommendation, RiskLevel } from './types';

const BY_CATEGORY: Partial<Record<IndicatorCategory, string[]>> = {
  phishing: [
    'Do not sign in through links in messages. Open the official app or type the address yourself.',
    'If you already entered a password, change it now and turn on two-factor authentication.',
  ],
  suspicious_link: ['Do not open the link. If you need to check it, use the URL Inspector here.'],
  suspicious_domain: ['Compare the domain with the organisation’s real website. Look-alike domains differ by one or two characters.'],
  impersonation: ['Contact the organisation using a phone number or website you find yourself, not one in the message.'],
  personal_info: [
    'Never share one-time codes, card details or ID documents in reply to a message.',
    'If you shared card details, call your bank using the number on the back of your card.',
  ],
  advance_fee: ['Do not pay any fee, deposit or charge. Legitimate jobs, prizes and deliveries do not require one.'],
  fake_job: ['Check the company and recruiter on the company’s official careers page before replying.'],
  unrealistic_earnings: ['Treat guaranteed returns as a red flag. Check the firm with your country’s financial regulator.'],
  urgency: ['Slow down. Pressure to act fast is a tactic, and real organisations will give you time.'],
  obfuscation: ['Hidden or look-alike characters are a deliberate trick. Treat the whole message as hostile.'],
};

export function buildRecommendations(findings: Finding[], level: RiskLevel): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const seen = new Set<string>();
  const add = (id: string, text: string, priority: Recommendation['priority']) => {
    if (seen.has(text)) return;
    seen.add(text);
    recommendations.push({ id, text, priority });
  };

  if (level === 'critical' || level === 'high') {
    add('general.no-reply', 'Do not reply, click links or call numbers in this message.', 'primary');
  }

  const categoriesByWeight = [...findings]
    .sort((a, b) => b.weight - a.weight)
    .map((f) => f.category)
    .filter((c, i, all) => all.indexOf(c) === i);

  for (const category of categoriesByWeight) {
    (BY_CATEGORY[category] ?? []).forEach((text, index) => {
      add(`${category}.${index}`, text, index === 0 && level !== 'low' ? 'primary' : 'secondary');
    });
  }

  if (level === 'critical' || level === 'high') {
    add('general.report', 'Report the message: forward scam SMS to your carrier’s spam number or use “Report junk” in your email app.', 'secondary');
    add('general.block', 'Block the sender and delete the message once you have reported it.', 'secondary');
  }
  if (level === 'low') {
    add(
      'general.low',
      'No common scam patterns were found, but a low score is not a guarantee. If the message asks for money or data, confirm through a channel you already trust.',
      'primary',
    );
  }
  return recommendations;
}
