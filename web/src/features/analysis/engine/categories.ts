import type { IndicatorCategory } from './types';

interface CategoryMeta {
  label: string;
  description: string;
}

export const CATEGORY_META: Record<IndicatorCategory, CategoryMeta> = {
  phishing: {
    label: 'Credential phishing',
    description: 'Attempts to get you to sign in, confirm or "verify" an account.',
  },
  suspicious_link: {
    label: 'Suspicious link',
    description: 'Links that hide or disguise where they really go.',
  },
  suspicious_domain: {
    label: 'Suspicious domain',
    description: 'Web addresses that imitate a known brand or use risky patterns.',
  },
  impersonation: {
    label: 'Brand impersonation',
    description: 'Claims to come from a company or institution it does not seem to belong to.',
  },
  personal_info: {
    label: 'Personal data request',
    description: 'Asks for codes, passwords, card or identity details.',
  },
  advance_fee: {
    label: 'Upfront payment',
    description: 'Asks you to pay a fee, deposit or charge before you receive anything.',
  },
  fake_job: {
    label: 'Fake job offer',
    description: 'Recruitment patterns common in employment scams.',
  },
  unrealistic_earnings: {
    label: 'Unrealistic earnings',
    description: 'Promises of guaranteed, outsized or effortless income.',
  },
  urgency: {
    label: 'Urgency & pressure',
    description: 'Deadlines, threats or secrecy meant to stop you from thinking it over.',
  },
  obfuscation: {
    label: 'Hidden characters',
    description: 'Invisible or look-alike characters used to evade filters or fool the eye.',
  },
};

export const RISK_LEVEL_META = {
  low: { label: 'Low risk', range: '0–24' },
  moderate: { label: 'Moderate risk', range: '25–49' },
  high: { label: 'High risk', range: '50–74' },
  critical: { label: 'Critical risk', range: '75–100' },
} as const;

export const CONTENT_TYPE_META = {
  sms: { label: 'SMS', placeholder: 'Paste the text message exactly as you received it.' },
  email: {
    label: 'Email',
    placeholder: 'Paste the email, including the sender line and subject if you have them.',
  },
  whatsapp: { label: 'WhatsApp', placeholder: 'Paste the WhatsApp message or conversation.' },
  job_offer: {
    label: 'Job offer',
    placeholder: 'Paste the job post or the recruiter message.',
  },
  url: { label: 'URL', placeholder: 'Paste a single link, for example https://example.com/login' },
} as const;
