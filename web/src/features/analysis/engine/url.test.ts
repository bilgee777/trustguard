import { defangUrl, extractUrls, inspectUrl } from './url';

const ruleIds = (url: string) => inspectUrl(url).findings.map((f) => f.ruleId);
const check = (url: string, id: string) => inspectUrl(url).checks.find((c) => c.id === id);

describe('inspectUrl', () => {
  it('treats official brand domains as clean', () => {
    const report = inspectUrl('https://www.paypal.com/signin');
    expect(report.findings).toEqual([]);
    expect(report.officialBrand).toBe('PayPal');
  });

  it.each([
    ['https://paypa1.com/login', 'Look-alike of PayPal'],
    ['https://rnicrosoft.com', 'Look-alike of Microsoft'],
    ['https://netfilx.com', 'Misspelling of Netflix'],
    ['https://paypal-secure-login.com', "Uses PayPal's name in a different domain"],
    ['https://paypal.com.account-check.net', 'PayPal name placed in a subdomain'],
  ])('flags %s as a brand look-alike', (url, title) => {
    expect(inspectUrl(url).findings.find((f) => f.ruleId === 'url.brand-lookalike')?.title).toBe(title);
  });

  it.each(['https://purchase.com', 'https://pineapple.com', 'https://github.com', 'https://chose.org'])(
    'does not flag %s as a look-alike (false-positive guard)',
    (url) => {
      expect(ruleIds(url)).not.toContain('url.brand-lookalike');
    },
  );

  it('decodes punycode and detects mixed alphabets', () => {
    const report = inspectUrl('https://xn--pypal-4ve.com');
    expect(report.parts?.unicodeHost).toBe('pаypal.com');
    // The owner is reported in its registered ASCII form, never the deceptive display form.
    expect(report.parts?.registrableDomain).toBe('xn--pypal-4ve.com');
    expect(check('https://xn--pypal-4ve.com', 'punycode')?.status).toBe('fail');
    expect(ruleIds('https://xn--pypal-4ve.com')).toContain('url.brand-lookalike');
  });

  it('reveals the real host behind an @ sign', () => {
    const report = inspectUrl('https://www.paypal.com@evil.example/login');
    expect(report.parts?.host).toBe('evil.example');
    expect(ruleIds('https://www.paypal.com@evil.example/login')).toContain('url.userinfo');
  });

  it('flags private and obfuscated IP addresses', () => {
    const ipTitle = (url: string) => inspectUrl(url).findings.find((f) => f.ruleId === 'url.ip-host')?.title;
    expect(ipTitle('http://192.168.1.1/admin')).toBe('Link to a private network address');
    expect(inspectUrl('http://0x7f000001/').parts?.host).toBe('127.0.0.1');
    expect(ipTitle('http://0x08080808/')).toBe('Disguised IP address');
    expect(ipTitle('http://8.8.8.8/')).toBe('Raw IP address instead of a domain');
  });

  it('flags dangerous schemes, shorteners, HTTP and abuse-heavy TLDs', () => {
    expect(ruleIds('javascript:alert(1)')).toContain('url.scheme');
    expect(ruleIds('https://bit.ly/3xYz')).toContain('url.shortener');
    expect(ruleIds('http://example.com')).toContain('url.scheme');
    expect(ruleIds('https://cheap-deals.xyz')).toContain('url.tld');
  });

  it('does not claim HTTP when no scheme was given', () => {
    expect(check('example.com', 'scheme')?.status).toBe('info');
  });

  it('rejects malformed and empty input without throwing', () => {
    expect(inspectUrl('').valid).toBe(false);
    expect(inspectUrl('https://exa mple.com').valid).toBe(false);
  });
});

describe('extractUrls', () => {
  it('finds scheme, www and bare-domain links with correct offsets', () => {
    const text = 'Go to https://a.example/x, or www.b.com, or bit.ly/abc.';
    const urls = extractUrls(text);
    expect(urls.map((u) => u.value)).toEqual(['https://a.example/x', 'www.b.com', 'bit.ly/abc']);
    for (const u of urls) expect(text.slice(u.start, u.end)).toBe(u.value);
  });

  it('ignores email addresses', () => {
    expect(extractUrls('Write to support@example.com')).toEqual([]);
  });
});

describe('defangUrl', () => {
  it('makes links non-clickable', () => {
    expect(defangUrl('https://evil.example.com/a.b')).toBe('hxxps://evil[.]example[.]com/a.b');
  });
});
