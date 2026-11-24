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
