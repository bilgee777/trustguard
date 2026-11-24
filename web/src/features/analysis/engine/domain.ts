import domainsData from '@shared/engine/domains.json';

/**
 * Simplified registrable-domain logic. A production system should use the full
 * Public Suffix List (publicsuffix.org); the shared list covers the most common
 * multi-label suffixes and is documented as a known limitation.
 */
const MULTI_LABEL_SUFFIXES = new Set(domainsData.multiLabelSuffixes);

export interface DomainSplit {
  registrable: string;
  /** Registrable domain without its public suffix, e.g. "paypal" for "paypal.co.uk". */
  name: string;
  suffix: string;
  subdomain: string;
}

export function splitDomain(host: string): DomainSplit {
  const labels = host.split('.').filter(Boolean);
  if (labels.length < 2) return { registrable: host, name: host, suffix: '', subdomain: '' };
  const lastTwo = labels.slice(-2).join('.');
  const suffixLength = MULTI_LABEL_SUFFIXES.has(lastTwo) && labels.length > 2 ? 2 : 1;
  const registrableLabels = labels.slice(-(suffixLength + 1));
  return {
    registrable: registrableLabels.join('.'),
    name: registrableLabels[0] ?? '',
    suffix: labels.slice(-suffixLength).join('.'),
    subdomain: labels.slice(0, -(suffixLength + 1)).join('.'),
  };
}

export const URL_SHORTENERS = new Set(domainsData.urlShorteners);

/** TLDs disproportionately used in abuse reports. Presence alone is a weak signal. */
export const HIGH_ABUSE_TLDS = new Set(domainsData.highAbuseTlds);

export function parseIPv4(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length !== 4) return null;
  const octets = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : NaN));
  return octets.every((o) => o >= 0 && o <= 255) ? octets : null;
}

/** Loopback, private, link-local and other non-public ranges (relevant to SSRF protection). */
export function isNonPublicIPv4([a = 0, b = 0]: number[]): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

export function isNonPublicIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase();
  return h === '::1' || h === '::' || /^f[cd]/.test(h) || /^fe[89ab]/.test(h) || h.startsWith('::ffff:');
}
