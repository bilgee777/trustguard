import { domainToUnicode } from 'node:url';
import { decodePunycodeLabel, hostToUnicode } from './punycode';

describe('punycode decoding', () => {
  it.each(['xn--pypal-4ve.com', 'xn--mnchen-3ya.de', 'xn--80ak6aa92e.com', 'xn--e1afmkfd.xn--p1ai', 'example.com'])(
    'matches the Node.js reference implementation for %s',
    (host) => {
      expect(hostToUnicode(host)).toBe(domainToUnicode(host));
    },
  );

  it('returns null for malformed input instead of throwing', () => {
    expect(decodePunycodeLabel('99999999999999')).toBeNull();
  });
});

describe('punycode hardening', () => {
  // These labels decode to code points above U+10FFFF. Before the fix they made
  // String.fromCodePoint throw a RangeError, which would have crashed analysis of a crafted link.
  it.each(['b922i', 'gb75y', 'ox27u'])('returns null instead of throwing for %s', (label) => {
    expect(decodePunycodeLabel(label)).toBeNull();
  });

  it('refuses to build a URL report from such a host without throwing', () => {
    expect(hostToUnicode('xn--b922i.com')).toBe('xn--b922i.com');
  });
});
