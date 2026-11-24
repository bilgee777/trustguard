import { render } from '@testing-library/react';
import { analyze } from '../engine';
import { EvidenceView } from './EvidenceView';

describe('EvidenceView', () => {
  it('renders pasted HTML as inert text (no XSS)', () => {
    const payload =
      '<img src=x onerror="window.__pwned=true"><script>window.__pwned=true</script> URGENT: verify your account';
    const result = analyze({ contentType: 'email', text: payload });
    const { container } = render(<EvidenceView result={result} activeFindingId={null} />);
    expect(container.querySelector('img, script')).toBeNull();
    expect(container.textContent).toContain('<script>');
    expect((window as unknown as { __pwned?: boolean }).__pwned).toBeUndefined();
  });

  it('marks flagged text and adds screen-reader labels', () => {
    const result = analyze({ contentType: 'sms', text: 'Act now: send me the OTP code we sent you.' });
    const { container } = render(<EvidenceView result={result} activeFindingId={null} />);
    expect(container.querySelectorAll('mark').length).toBeGreaterThan(0);
    expect(container.textContent).toContain('(flagged: Asks for a one-time code');
  });
});
