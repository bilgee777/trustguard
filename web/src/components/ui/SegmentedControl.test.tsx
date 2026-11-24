import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl } from './SegmentedControl';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
] as const;

function Harness() {
  const [value, setValue] = useState<'a' | 'b' | 'c'>('a');
  return <SegmentedControl label="Pick one" options={OPTIONS} value={value} onChange={setValue} />;
}

describe('SegmentedControl', () => {
  it('is a single tab stop and moves selection with arrow keys', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.tab();
    expect(screen.getByRole('radio', { name: 'Alpha' })).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('radio', { name: 'Beta' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Beta' })).toHaveFocus();
    await user.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(screen.getByRole('radio', { name: 'Gamma' })).toBeChecked();
    expect(screen.getAllByRole('radio').filter((r) => r.tabIndex === 0)).toHaveLength(1);
  });
});
