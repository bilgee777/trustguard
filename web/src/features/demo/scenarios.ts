import type { ContentType, RiskLevel } from '@/features/analysis/engine';

export interface DemoScenario {
  id: string;
  title: string;
  contentType: ContentType;
  /** What the user should learn to spot. Shown before the analysis runs. */
  lesson: string;
  text: string;
  expectedLevel: RiskLevel;
}

/**
 * Fictional samples written for education. Every domain below is invented for the demo;
 * the engine runs on them live, nothing here is a pre-computed result.
 */
export const DEMO_SCENARIOS: DemoScenario[] = [
  {
    id: 'fake-remote-job',
    title: 'Fake remote job offer',
    contentType: 'job_offer',
    lesson: 'High pay for trivial work, a Telegram-only interview and a “refundable” registration fee.',
    text: `Hi! I'm Emily from TalentBridge HR. Your profile was selected for a remote Data Entry Assistant position.

No experience required. You only need a smartphone and 1-2 hours a day, and you can earn $350 per day.

The interview is held on Telegram, so please contact our hiring manager via Telegram: t.me/talentbridge_hr

To activate your account you must pay a one-time registration fee of $49, which is refundable after your first week. Only 3 spots left, reply today!`,
    expectedLevel: 'critical',
  },
  {
    id: 'fake-bank-sms',
    title: 'Fake bank SMS',
    contentType: 'sms',
    lesson: 'The brand name sits in front of a domain it does not own. The real owner is the part before “/login”.',
    text: 'CHASE ALERT: Unusual sign-in detected on your account. Your online banking will be suspended within 24 hours. Verify your identity now: https://chase.com-secure-verify.top/login',
    expectedLevel: 'critical',
  },
  {
    id: 'fake-delivery',
    title: 'Fake delivery notification',
    contentType: 'sms',
    lesson: 'A tiny fee makes the request feel harmless. The goal is your card details, not the $1.99.',
    text: 'DHL: Your parcel could not be delivered due to an incomplete address. A redelivery fee of $1.99 is required. Reschedule your delivery here: http://dhl-parcel-redelivery.xyz/track?id=DE77412',
    expectedLevel: 'critical',
  },
  {
    id: 'crypto-scam',
    title: 'Cryptocurrency investment scam',
    contentType: 'whatsapp',
    lesson: 'Guaranteed weekly returns, payment in USDT and a request to keep it secret.',
    text: `Hello dear, I am Anna, a crypto investment mentor 🌟 My students make guaranteed profits of 30% weekly returns on our trading platform.

Start with only $200 and double your money in 7 days. Just send USDT to the wallet address I give you and I will handle the rest.

Please keep this between us, the group is private.`,
    expectedLevel: 'critical',
  },
  {
    id: 'phishing-email',
    title: 'Phishing email',
    contentType: 'email',
    lesson: 'The sender and link replace the letter “l” with the digit “1”, and the real domain is account-review.info.',
    text: `From: PayPal Service <service@paypa1-support.com>
Subject: Your account has been limited

Dear Customer,

We noticed suspicious activity on your account. Your account has been restricted until you confirm your billing information.

Please log in to verify your account within 48 hours or it will be permanently closed:
https://www.paypa1.com.account-review.info/signin

PayPal Security Team`,
    expectedLevel: 'critical',
  },
  {
    id: 'legitimate-message',
    title: 'Legitimate message',
    contentType: 'email',
    lesson: 'A shipping notice with no requests and a link to the official domain. Low risk still means “verify if in doubt”.',
    text: `Hi Sam,

Your Amazon order of "Wireless Keyboard" has shipped and should arrive on Thursday. You can track it any time in the Amazon app or under Your Orders:
https://www.amazon.com/gp/your-account/order-history

Thanks for shopping with us.`,
    expectedLevel: 'low',
  },
];

export function findScenario(id: string): DemoScenario | undefined {
  return DEMO_SCENARIOS.find((s) => s.id === id);
}
