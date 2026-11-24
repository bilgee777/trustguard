import type { ContentType, IndicatorCategory } from './types';

export interface TextRule {
  id: string;
  category: IndicatorCategory;
  title: string;
  explanation: string;
  weight: number;
  patterns: RegExp[];
  /** Multiplies the weight when the content type makes the pattern more telling. */
  boost?: Partial<Record<ContentType, number>>;
}

const p = (source: string): RegExp => new RegExp(source, 'giu');

/**
 * Each rule is independent and contributes at most once, however many times it matches,
 * so repeating a word cannot inflate the score. Weights are calibrated by hand against
 * the demo corpus and the unit tests; they are heuristics, not measured probabilities.
 */
export const TEXT_RULES: TextRule[] = [
  {
    id: 'urgency.deadline',
    category: 'urgency',
    title: 'Artificial deadline',
    explanation:
      'Scammers set short deadlines so you act before you have time to check. Real organisations rarely demand action within hours.',
    weight: 0.18,
    patterns: [
      p(String.raw`\b(urgent(ly)?|immediately|right away|act now|asap|last chance|final (notice|warning|reminder))\b`),
      p(String.raw`\bwithin (the next )?(\d{1,2}|twenty[- ]four|forty[- ]eight) ?(hours?|hrs?|minutes?|mins?)\b`),
      p(String.raw`\b(expires?|ends?) (today|tonight|soon|in \d+ ?(hours?|minutes?))\b`),
      p(String.raw`\b(today only|limited time|only \d+ (spots|places|slots) left)\b`),
    ],
  },
  {
    id: 'urgency.threat',
    category: 'urgency',
    title: 'Threat of consequences',
    explanation:
      'Messages that threaten suspension, fines or legal action are designed to trigger fear. Contact the organisation through its official app or number instead.',
    weight: 0.22,
    patterns: [
      p(
        String.raw`\b(will be|has been|have been|is being) (suspended|locked|blocked|terminated|deactivated|disabled|closed|frozen|restricted)\b`,
      ),
      p(String.raw`\b(legal action|arrest warrant|police|court summons|penalty|fined|late fee)\b`),
      p(String.raw`\b(unusual|suspicious|unauthori[sz]ed) (activity|sign-?in|login|transaction|access)\b`),
    ],
  },
  {
    id: 'urgency.secrecy',
    category: 'urgency',
    title: 'Request for secrecy',
    explanation:
      'Being told to keep something secret isolates you from people who could warn you. Legitimate employers and banks do not ask for this.',
    weight: 0.22,
    patterns: [
      p(
        String.raw`\b(keep (this|it) (confidential|secret|between us|private)|don'?t tell (anyone|your)|do not (tell|share this with|discuss))\b`,
      ),
    ],
  },
  {
    id: 'phishing.credentials',
    category: 'phishing',
    title: 'Asks you to sign in or verify your account',
    explanation:
      'A message that asks you to "verify" or "confirm" an account through a link is the classic phishing pattern. Open the official app or type the address yourself.',
    weight: 0.32,
    patterns: [
      p(
        String.raw`\b(verify|confirm|validate|update|restore|reactivate|unlock)( your)? (account|identity|details|information|login|credentials|password|payment (details|method|information)|billing (details|information))\b`,
      ),
      p(String.raw`\b(log ?in|sign ?in)( now)? (to|and) (verify|confirm|restore|avoid|keep|secure|update)\b`),
      p(String.raw`\b(reset|change) your password\b`),
    ],
  },
  {
    id: 'phishing.click_prompt',
    category: 'suspicious_link',
    title: 'Pushes you to click a link',
    explanation:
      '"Click here" on its own is common in newsletters, so this is a weak signal. It matters when combined with urgency or account requests.',
    weight: 0.08,
    patterns: [p(String.raw`\b(click|tap|follow|open) (the |this )?(link|here|below|button)\b`)],
  },
  {
    id: 'phishing.generic_greeting',
    category: 'phishing',
    title: 'Generic greeting',
    explanation:
      'Companies you have an account with usually address you by name. A generic greeting suggests a message sent to thousands of people.',
    weight: 0.08,
    patterns: [
      p(
        String.raw`\bdear (customer|user|client|member|account ?holder|valued (customer|member|client)|sir(\/| or )madam|beneficiary|applicant)\b`,
      ),
    ],
  },
  {
    id: 'personal_info.otp',
    category: 'personal_info',
    title: 'Asks for a one-time code',
    explanation:
      'One-time codes prove that you are approving something. Anyone who asks you to share one is trying to log in or pay as you. No real company asks for these.',
    weight: 0.55,
    patterns: [
      p(
        String.raw`\b(share|send|tell|give|forward|reply with|read out|provide)\b.{0,40}\b(code|otp|pin|passcode|verification number)\b`,
      ),
      p(String.raw`\b(code|otp|pin)\b.{0,30}\b(we|i) (just )?sent (to )?you\b`),
    ],
  },
  {
    id: 'personal_info.sensitive',
    category: 'personal_info',
    title: 'Asks for sensitive personal data',
    explanation:
      'Card numbers, CVV codes, ID scans and bank logins let criminals steal money or your identity. Never share them in reply to a message.',
    weight: 0.35,
    patterns: [
      p(
        String.raw`\b(card (number|details)|cvv|cvc|security code|expiry date|pin (number|code)|online banking (password|login)|bank (login|password))\b`,
      ),
      p(
        String.raw`\b(social security( number)?|ssn|national (id|insurance)( number)?|passport (number|copy|scan|photo)|(copy|scan|photo) of your (id|passport|driver'?s licen[cs]e)|mother'?s maiden name|date of birth)\b`,
      ),
      p(String.raw`\b(seed phrase|recovery phrase|secret phrase|private key|12[- ]word phrase)\b`),
    ],
  },
  {
    id: 'advance_fee.payment',
    category: 'advance_fee',
    title: 'Asks you to pay a fee first',
    explanation:
      'Requests to pay a small fee, deposit or charge before you receive a parcel, job, prize or refund are the core of advance-fee fraud.',
    weight: 0.32,
    patterns: [
      p(
        String.raw`\b(processing|registration|activation|customs|delivery|shipping|redelivery|clearance|release|admin(istration)?|training|onboarding|verification|application) (fee|charge|payment|cost)\b`,
      ),
      p(String.raw`\b(pay|send|transfer|deposit)\b.{0,40}\b(fee|deposit|charge|upfront|in advance)\b`),
      p(String.raw`\b(small|one-time|refundable) (fee|payment|deposit|charge)\b`),
      p(String.raw`\b(outstanding|unpaid) (fee|amount|balance|charge|toll)\b`),
    ],
  },
  {
    id: 'advance_fee.untraceable',
    category: 'advance_fee',
    title: 'Untraceable payment method',
    explanation:
      'Gift cards, crypto and wire services are requested because payments cannot be reversed or traced. Legitimate businesses do not demand them.',
    weight: 0.4,
    patterns: [
      p(
        String.raw`\b(gift ?cards?|itunes cards?|google play cards?|steam cards?|western union|moneygram|wire transfer)\b`,
      ),
      p(String.raw`\b(pay|send|transfer|deposit)\b.{0,30}\b(usdt|bitcoin|btc|eth|crypto(currency)?|wallet address)\b`),
    ],
  },
  {
    id: 'fake_job.too_easy',
    category: 'fake_job',
    title: 'Job that sounds too easy',
    explanation:
      'Offers that need no experience, no interview and pay for trivial tasks like liking videos are common in task and recruitment scams.',
    weight: 0.25,
    boost: { job_offer: 1.3, whatsapp: 1.2 },
    patterns: [
      p(
        String.raw`\b(no (experience|skills|qualifications|interview) (needed|required|necessary)|hired (immediately|instantly|today)|start (today|immediately))\b`,
      ),
      p(
        String.raw`\b(like|rate|review|watch)\b.{0,20}\b(videos|posts|products|hotels|apps)\b.{0,40}\b(earn|paid|commission|\$|€|£)`,
      ),
      p(String.raw`\b(task-based|per task|commission per (task|order)|daily tasks|simple online tasks)\b`),
      p(String.raw`\bonly (need|requires?) (a )?(phone|smartphone|\d+ ?(minutes?|hours?) (a|per) day)\b`),
    ],
  },
  {
    id: 'fake_job.off_platform',
    category: 'fake_job',
    title: 'Moves you to a private chat',
    explanation:
      'Fake recruiters push conversations to Telegram, WhatsApp or Signal, where there is no company record and accounts disappear easily.',
    weight: 0.28,
    boost: { job_offer: 1.3 },
    patterns: [
      p(
        String.raw`\b(contact|message|text|add|reach|chat with)\b.{0,40}\b(on|via|through) (telegram|whatsapp|signal|wechat)\b`,
      ),
      p(
        String.raw`\b(interview|onboarding|recruiter|hr manager|hiring manager)\b.{0,40}\b(telegram|whatsapp|signal)\b`,
      ),
      p(String.raw`\b(t\.me|wa\.me)\/`),
    ],
  },
  {
    id: 'fake_job.equipment',
    category: 'fake_job',
    title: 'Equipment or check payment scheme',
    explanation:
      'A new "employer" who sends you a check to buy equipment from their vendor is running a fake-check scam: the check bounces after you have paid.',
    weight: 0.45,
    boost: { job_offer: 1.2 },
    patterns: [
      p(String.raw`\b(check|cheque)\b.{0,60}\b(equipment|laptop|software|supplies|vendor)\b`),
      p(String.raw`\b(purchase|buy) (your )?(equipment|laptop|work supplies)\b.{0,40}\b(vendor|reimburs)`),
    ],
  },
  {
    id: 'earnings.unrealistic',
    category: 'unrealistic_earnings',
    title: 'Unrealistic earnings promise',
    explanation:
      'Guaranteed profits or high pay for little effort do not exist. These promises are the hook for investment, task and job scams.',
    weight: 0.3,
    boost: { job_offer: 1.2 },
    patterns: [
      p(
        String.raw`\b(earn|make|get|receive)\b.{0,15}(\$|€|£|usd|eur)\s?\d[\d,.]*\s?k?\b.{0,20}\b(per|a|\/|each|every)\s?(day|daily|week|weekly|hour)\b`,
      ),
      p(String.raw`(\$|€|£)\s?\d[\d,.]*\s?k?\s?(\/|per|a)\s?(day|hour)\b`),
      p(String.raw`\b(guaranteed|risk[- ]free|fixed) (profit|returns?|income|earnings|payout)s?\b`),
      p(String.raw`\b(double|triple|10x) your (money|investment|crypto|bitcoin)\b`),
      p(String.raw`\b\d{2,4} ?% (daily |weekly |monthly )?(returns?|profit|roi|interest)\b`),
      p(String.raw`\b(passive income|financial freedom|get rich|quit your job)\b`),
    ],
  },
  {
    id: 'earnings.prize',
    category: 'unrealistic_earnings',
    title: 'Prize or reward you did not enter for',
    explanation:
      'You cannot win a lottery or giveaway you never entered. "Claim your prize" messages usually lead to a fee request or a phishing page.',
    weight: 0.32,
    patterns: [
      p(
        String.raw`\b(you('ve| have)? (won|been (selected|chosen))|congratulations\b.{0,40}\b(won|winner|selected|chosen|prize))\b`,
      ),
      p(String.raw`\b(claim|collect|redeem) your (prize|reward|gift|winnings|bonus|refund)\b`),
      p(String.raw`\b(lottery|jackpot|sweepstakes|lucky (winner|draw)|free (iphone|gift card|vacation))\b`),
    ],
  },
  {
    id: 'crypto.investment',
    category: 'unrealistic_earnings',
    title: 'Crypto investment pitch',
    explanation:
      'Unsolicited crypto "opportunities", trading platforms and mentors are the leading form of investment fraud. Deposits are rarely recoverable.',
    weight: 0.2,
    patterns: [
      p(
        String.raw`\b(crypto(currency)? (investment|trading|opportunity|platform|mentor)|trading (platform|signals|bot)|mining pool|airdrop|liquidity mining)\b`,
      ),
      p(String.raw`\b(invest|deposit)\b.{0,30}\b(bitcoin|btc|usdt|eth|crypto)\b`),
    ],
  },
  {
    id: 'delivery.failed',
    category: 'phishing',
    title: 'Parcel delivery problem',
    explanation:
      'Fake "failed delivery" messages are among the most common SMS scams. Check the tracking number on the carrier\'s official website instead.',
    weight: 0.2,
    boost: { sms: 1.2 },
    patterns: [
      p(
        String.raw`\b(package|parcel|shipment|delivery|order)\b.{0,60}\b(failed|on hold|held|pending|could not be delivered|unable to deliver|undeliverable|returned|awaiting payment|incomplete address)\b`,
      ),
      p(String.raw`\b(reschedule|redeliver(y)?|re-delivery) (your )?(delivery|package|parcel)?\b`),
    ],
  },
];
