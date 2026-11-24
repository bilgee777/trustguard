export interface Brand {
  name: string;
  /** Words that refer to the brand in message text (matched on word boundaries). */
  keywords: string[];
  /** Official registrable domains. Subdomains of these are treated as official. */
  domains: string[];
}

/**
 * A curated, intentionally small list of frequently impersonated organisations.
 * It is a heuristic seed, not an allow-list of "safe" sites: an official domain only
 * removes the look-alike warnings, it never makes a message safe by itself.
 */
export const BRANDS: Brand[] = [
  { name: 'PayPal', keywords: ['paypal'], domains: ['paypal.com', 'paypal.me'] },
  {
    name: 'Amazon',
    keywords: ['amazon'],
    domains: ['amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.com.tr', 'amazon.fr', 'amazon.es'],
  },
  { name: 'Apple', keywords: ['apple', 'icloud', 'apple id'], domains: ['apple.com', 'icloud.com'] },
  {
    name: 'Microsoft',
    keywords: ['microsoft', 'outlook', 'office 365', 'office365'],
    domains: ['microsoft.com', 'live.com', 'outlook.com', 'office.com', 'microsoftonline.com'],
  },
  { name: 'Google', keywords: ['google', 'gmail'], domains: ['google.com', 'gmail.com', 'youtube.com'] },
  { name: 'Netflix', keywords: ['netflix'], domains: ['netflix.com'] },
  { name: 'DHL', keywords: ['dhl'], domains: ['dhl.com', 'dhl.de'] },
  { name: 'FedEx', keywords: ['fedex'], domains: ['fedex.com'] },
  { name: 'UPS', keywords: ['ups'], domains: ['ups.com'] },
  { name: 'USPS', keywords: ['usps'], domains: ['usps.com'] },
  { name: 'Royal Mail', keywords: ['royal mail', 'royalmail'], domains: ['royalmail.com'] },
  {
    name: 'Meta',
    keywords: ['facebook', 'instagram', 'meta'],
    domains: ['facebook.com', 'instagram.com', 'meta.com'],
  },
  { name: 'WhatsApp', keywords: ['whatsapp'], domains: ['whatsapp.com'] },
  { name: 'LinkedIn', keywords: ['linkedin'], domains: ['linkedin.com'] },
  { name: 'Binance', keywords: ['binance'], domains: ['binance.com'] },
  { name: 'Coinbase', keywords: ['coinbase'], domains: ['coinbase.com'] },
  { name: 'Chase', keywords: ['chase bank', 'chase'], domains: ['chase.com'] },
  { name: 'Bank of America', keywords: ['bank of america', 'bankofamerica'], domains: ['bankofamerica.com'] },
  { name: 'Wells Fargo', keywords: ['wells fargo', 'wellsfargo'], domains: ['wellsfargo.com'] },
  { name: 'HSBC', keywords: ['hsbc'], domains: ['hsbc.com', 'hsbc.co.uk'] },
  { name: 'IRS', keywords: ['irs', 'internal revenue service'], domains: ['irs.gov'] },
  { name: 'HMRC', keywords: ['hmrc'], domains: ['gov.uk'] },
];

/** Brand tokens used for look-alike domain detection (multi-word keywords collapsed). */
export const BRAND_TOKENS: { brand: Brand; token: string }[] = BRANDS.flatMap((brand) =>
  [...new Set(brand.keywords.map((k) => k.replace(/\s+/g, '')))].map((token) => ({ brand, token })),
);

export function isOfficialHost(host: string, brand: Brand): boolean {
  return brand.domains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function findOfficialBrand(host: string): Brand | null {
  return BRANDS.find((brand) => isOfficialHost(host, brand)) ?? null;
}
