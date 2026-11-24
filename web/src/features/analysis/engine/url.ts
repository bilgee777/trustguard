import { BRAND_TOKENS, findOfficialBrand, type Brand } from './brands';
import { HIGH_ABUSE_TLDS, URL_SHORTENERS, isNonPublicIPv4, isNonPublicIPv6, parseIPv4, splitDomain } from './domain';
import { hostToUnicode } from './punycode';
import { combineWeights, levelForScore } from './scoring';
import type { Finding, IndicatorCategory, UrlCheck, UrlCheckStatus, UrlReport } from './types';
import { isMixedScript, levenshtein, skeleton } from './unicode';

const DANGEROUS_SCHEMES = new Set(['javascript', 'data', 'vbscript', 'file']);
const SENSITIVE_WORDS =
  /(log-?in|sign-?in|verify|verification|secure|account|update|unlock|confirm|billing|password|wallet|suspend|restore)/i;
const MAX_URL_LENGTH = 2048;

interface CheckSpec {
  id: string;
  label: string;
  status: UrlCheckStatus;
  detail: string;
  /** Present only for warn/fail checks that should contribute to the risk score. */
  finding?: { category: IndicatorCategory; title: string; weight: number };
}

function hasExplicitScheme(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value) || /^(javascript|data|vbscript|file|mailto|tel):/i.test(value);
}

/** Makes a URL safe to display and copy: it can no longer be clicked or auto-linked. */
export function defangUrl(value: string): string {
  const schemeMatch = /^([a-z][a-z0-9+.-]*):\/\//i.exec(value);
  const scheme = schemeMatch?.[1] ?? '';
  const rest = schemeMatch ? value.slice(schemeMatch[0].length) : value;
  const slash = rest.search(/[/?#]/);
  const authority = slash === -1 ? rest : rest.slice(0, slash);
  const tail = slash === -1 ? '' : rest.slice(slash);
  const safeScheme = scheme ? `${scheme.replace(/^http/i, 'hxxp')}://` : '';
  return `${safeScheme}${authority.replace(/\./g, '[.]')}${tail}`;
}

function invalidReport(input: string, detail: string): UrlReport {
  return {
    input,
    defanged: defangUrl(input),
    valid: false,
    parts: null,
    checks: [{ id: 'parse', label: 'Valid address', status: 'warn', detail }],
    findings: [],
    score: 0,
    level: 'low',
    officialBrand: null,
  };
}

function brandLookalike(name: string, subdomain: string, host: string): CheckSpec | null {
  const nameSkeleton = skeleton(name);
  const nameTokens = name.split('-');
  const subLabels = subdomain.split(/[.-]/).filter(Boolean);

  for (const { brand, token } of BRAND_TOKENS) {
    if (name === token) continue;
    const imitates = (detail: string, title: string, weight: number): CheckSpec => ({
      id: 'brand-lookalike',
      label: 'Brand look-alike',
      status: 'fail',
      detail,
      finding: { category: 'suspicious_domain', title, weight },
    });

    if (nameSkeleton === token) {
      return imitates(
        `"${name}" is built from characters that imitate "${token}", but this is not ${brand.name}'s official domain (${brand.domains.join(', ')}).`,
        `Look-alike of ${brand.name}`,
        0.6,
      );
    }
    if (token.length >= 6) {
      const distance = levenshtein(nameSkeleton, token);
      if (distance > 0 && distance <= (token.length >= 7 ? 2 : 1)) {
        return imitates(
          `"${name}" is one or two characters away from "${token}". Typo-squatted domains like this are registered to catch people who don't read addresses closely.`,
          `Misspelling of ${brand.name}`,
          0.5,
        );
      }
    }
    // Prefix/suffix only, and only for longer tokens: "paypalsecure" is suspicious,
    // but "purchase" must not match "chase" and "pineapple" must not match "apple".
    const inName =
      nameTokens.includes(token) ||
      (token.length >= 6 && (nameSkeleton.startsWith(token) || nameSkeleton.endsWith(token)));
    if (inName) {
      return imitates(
        `The domain contains "${token}", but it is registered as ${host.split('.').slice(-2).join('.')}, not by ${brand.name}. Anyone can register a domain that contains a brand name.`,
        `Uses ${brand.name}'s name in a different domain`,
        0.5,
      );
    }
    if (subLabels.some((label) => skeleton(label) === token)) {
      return imitates(
        `"${token}" appears only in the subdomain. The part that decides who owns the site is the registrable domain at the end of the host.`,
        `${brand.name} name placed in a subdomain`,
        0.5,
      );
    }
  }
  return null;
}

export function inspectUrl(rawInput: string): UrlReport {
  const input = rawInput.trim();
  if (!input) return invalidReport(input, 'Enter a URL to inspect.');
  if (input.length > MAX_URL_LENGTH)
    return invalidReport(input, `URLs longer than ${MAX_URL_LENGTH} characters are not inspected.`);

  const schemeProvided = hasExplicitScheme(input);
  let url: URL;
  try {
    url = new URL(schemeProvided ? input : `https://${input}`);
  } catch {
    return invalidReport(input, 'This is not a well-formed web address.');
  }

  const scheme = url.protocol.replace(/:$/, '').toLowerCase();
  const checks: CheckSpec[] = [];

  if (DANGEROUS_SCHEMES.has(scheme)) {
    checks.push({
      id: 'scheme',
      label: 'Protocol',
      status: 'fail',
      detail: `"${scheme}:" links can run code or load embedded content instead of opening a website.`,
      finding: { category: 'suspicious_link', title: `Dangerous "${scheme}:" link`, weight: 0.7 },
    });
  }
  if (scheme !== 'http' && scheme !== 'https') {
    if (!DANGEROUS_SCHEMES.has(scheme)) {
      checks.push({ id: 'scheme', label: 'Protocol', status: 'info', detail: `"${scheme}:" is not a website link.` });
    }
    return finalize(input, url, scheme, null, checks, null);
  }

  const host = url.hostname.toLowerCase();
  const unicodeHost = hostToUnicode(host);
  const split = splitDomain(unicodeHost);
  const officialBrand = findOfficialBrand(host);

  if (!schemeProvided) {
    checks.push({
      id: 'scheme',
      label: 'HTTPS',
      status: 'info',
      detail: 'No protocol was given, so we cannot tell whether the link uses HTTPS.',
    });
  } else if (scheme === 'http') {
    checks.push({
      id: 'scheme',
      label: 'HTTPS',
      status: 'warn',
      detail: 'The link uses unencrypted HTTP. Legitimate login and payment pages always use HTTPS.',
      finding: { category: 'suspicious_link', title: 'Unencrypted HTTP link', weight: 0.15 },
    });
  } else {
    checks.push({
      id: 'scheme',
      label: 'HTTPS',
      status: 'pass',
      detail: 'Uses HTTPS. This only means the connection is encrypted. Most phishing sites use HTTPS too.',
    });
  }

  if (url.username || url.password) {
    const decoy = skeleton(decodeURIComponent(url.username));
    const borrowed = BRAND_TOKENS.find(({ token }) => decoy.includes(token))?.brand;
    checks.push({
      id: 'userinfo',
      label: 'Hidden destination',
      status: 'fail',
      detail: `Everything before "@" is ignored by the browser${borrowed ? `, so "${borrowed.name}" there is only decoration` : ''}. This link really opens ${host}.`,
      finding: { category: 'suspicious_link', title: 'Text before "@" disguises the real site', weight: 0.45 },
    });
  }

  const ipv4 = parseIPv4(host);
  const isIPv6 = host.startsWith('[');
  if (ipv4 || isIPv6) {
    const nonPublic = ipv4 ? isNonPublicIPv4(ipv4) : isNonPublicIPv6(host);
    const rawHost = /^[a-z]+:\/\/([^/?#]+)/i.exec(input)?.[1] ?? input.split(/[/?#]/)[0] ?? '';
    const obfuscated = ipv4 !== null && !rawHost.endsWith(host) && !rawHost.includes(`@${host}`);
    checks.push({
      id: 'ip-host',
      label: 'Domain name',
      status: 'fail',
      detail: nonPublic
        ? 'The link points to a private or internal network address. A message from outside should never send you there.'
        : obfuscated
          ? `The address is written in an unusual numeric form that browsers convert to ${host}. This is a common filter-evasion trick.`
          : 'The link uses a raw IP address instead of a domain name, which hides who operates the site.',
      finding: {
        category: 'suspicious_domain',
        title: nonPublic
          ? 'Link to a private network address'
          : obfuscated
            ? 'Disguised IP address'
            : 'Raw IP address instead of a domain',
        weight: obfuscated || nonPublic ? 0.5 : 0.35,
      },
    });
    return finalize(input, url, scheme, unicodeHost, checks, null);
  }

  if (URL_SHORTENERS.has(host)) {
    checks.push({
      id: 'shortener',
      label: 'URL shortener',
      status: 'warn',
      detail: `${host} is a link shortener. The real destination is hidden until you open it.`,
      finding: { category: 'suspicious_link', title: 'Shortened link hides the destination', weight: 0.2 },
    });
  }

  if (host.split('.').some((label) => label.startsWith('xn--'))) {
    const mixed = unicodeHost.split('.').some(isMixedScript);
    checks.push({
      id: 'punycode',
      label: 'International characters',
      status: mixed ? 'fail' : 'warn',
      detail: mixed
        ? `The domain displays as "${unicodeHost}" and mixes alphabets. Letters from other alphabets can look identical to Latin ones.`
        : `The domain uses non-Latin characters and displays as "${unicodeHost}". That is normal for some languages, but it is also used to imitate familiar names.`,
      finding: mixed
        ? { category: 'obfuscation', title: 'Domain mixes look-alike alphabets', weight: 0.45 }
        : { category: 'suspicious_domain', title: 'Internationalized (punycode) domain', weight: 0.2 },
    });
  }

  if (officialBrand) {
    checks.push({
      id: 'brand-lookalike',
      label: 'Brand look-alike',
      status: 'pass',
      detail: `${split.registrable} is a known official domain of ${officialBrand.name}. That does not make the message itself trustworthy.`,
    });
  } else {
    const lookalike = brandLookalike(split.name, split.subdomain, host);
    checks.push(
      lookalike ?? {
        id: 'brand-lookalike',
        label: 'Brand look-alike',
        status: 'pass',
        detail: 'Does not imitate any of the brands we track.',
      },
    );
  }

  const tld = split.suffix.split('.').pop() ?? '';
  if (HIGH_ABUSE_TLDS.has(tld)) {
    checks.push({
      id: 'tld',
      label: 'Domain ending',
      status: 'warn',
      detail: `".${tld}" domains are cheap to register and show up often in abuse reports. Many are legitimate, so this is a weak signal on its own.`,
      finding: { category: 'suspicious_domain', title: `High-abuse ".${tld}" domain ending`, weight: 0.15 },
    });
  }

  const subdomainDepth = split.subdomain ? split.subdomain.split('.').length : 0;
  if (subdomainDepth >= 3) {
    checks.push({
      id: 'subdomains',
      label: 'Subdomain depth',
      status: 'warn',
      detail: `The address has ${subdomainDepth} subdomain levels. Long chains push the real domain out of view on small screens.`,
      finding: { category: 'suspicious_domain', title: 'Unusually deep subdomain chain', weight: 0.15 },
    });
  }

  if ((split.name.match(/-/g) ?? []).length >= 2) {
    checks.push({
      id: 'hyphens',
      label: 'Domain structure',
      status: 'warn',
      detail: `"${split.registrable}" strings several words together with hyphens, a pattern common in throwaway phishing domains.`,
      finding: { category: 'suspicious_domain', title: 'Hyphen-heavy domain name', weight: 0.1 },
    });
  }

  if (url.port) {
    checks.push({
      id: 'port',
      label: 'Port',
      status: 'warn',
      detail: `The link uses port ${url.port}. Public websites rarely need a custom port.`,
      finding: { category: 'suspicious_link', title: 'Non-standard port', weight: 0.1 },
    });
  }

  if (!officialBrand && SENSITIVE_WORDS.test(`${host}${url.pathname}`)) {
    const word = SENSITIVE_WORDS.exec(`${host}${url.pathname}`)?.[0] ?? '';
    checks.push({
      id: 'sensitive-path',
      label: 'Account wording',
      status: 'warn',
      detail: `The address contains "${word}". Phishing pages use account and login wording to look official.`,
      finding: { category: 'phishing', title: 'Login or account wording in the address', weight: 0.12 },
    });
  }

  if (input.length > 120) {
    checks.push({
      id: 'length',
      label: 'Length',
      status: 'info',
      detail: `The link is ${input.length} characters long. Long links make it harder to see where they lead.`,
    });
  }

  return finalize(input, url, scheme, unicodeHost, checks, officialBrand);
}

function finalize(
  input: string,
  url: URL,
  scheme: string,
  unicodeHost: string | null,
  specs: CheckSpec[],
  officialBrand: Brand | null,
): UrlReport {
  const host = url.hostname.toLowerCase();
  // Ownership is reported in the ASCII (punycode) form: that is the name actually registered.
  // The Unicode form is what an attacker wants you to see, so it is only shown as a display hint.
  const split = splitDomain(host);
  const findings: Finding[] = specs.flatMap((spec) =>
    spec.finding
      ? [
          {
            id: `url.${spec.id}`,
            ruleId: `url.${spec.id}`,
            category: spec.finding.category,
            title: spec.finding.title,
            explanation: spec.detail,
            weight: spec.finding.weight,
            evidence: [defangUrl(input)],
            spans: [],
          },
        ]
      : [],
  );
  const score = combineWeights(findings.map((f) => f.weight));
  const checks: UrlCheck[] = specs.map(({ id, label, status, detail }) => ({ id, label, status, detail }));

  return {
    input,
    defanged: defangUrl(input),
    valid: true,
    parts: {
      scheme,
      username: url.username || null,
      host,
      unicodeHost: unicodeHost ?? host,
      registrableDomain: split.registrable,
      subdomain: split.subdomain,
      port: url.port || null,
      path: url.pathname,
      query: url.search,
    },
    checks,
    findings,
    score,
    level: levelForScore(score),
    officialBrand: officialBrand?.name ?? null,
  };
}

export interface ExtractedUrl {
  value: string;
  start: number;
  end: number;
}

const KNOWN_TLDS =
  'com|net|org|io|co|info|biz|me|app|dev|ai|gov|edu|uk|de|fr|es|it|nl|tr|ru|cn|in|br|au|ca|us|eu|ly|gl|gd|at|to|cc|id|' +
  [...HIGH_ABUSE_TLDS].join('|');

const URL_PATTERN = new RegExp(
  String.raw`(?:(?:https?|javascript|data):[^\s<>"'\x60]+|www\.[^\s<>"'\x60]+|(?<![@\p{L}\p{N}.-])(?:[\p{L}\p{N}-]+\.)+(?:${KNOWN_TLDS})(?![\p{L}\p{N}-])(?::\d{2,5})?(?:[/?#][^\s<>"'\x60]*)?)`,
  'giu',
);

export function extractUrls(text: string): ExtractedUrl[] {
  const results: ExtractedUrl[] = [];
  for (const match of text.matchAll(URL_PATTERN)) {
    const value = match[0].replace(/[.,;:!?)\]}'"]+$/u, '');
    if (value.length < 4) continue;
    results.push({ value, start: match.index, end: match.index + value.length });
  }
  return results;
}
