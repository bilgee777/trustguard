import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { ConfirmDialog } from './ConfirmDialog';

function Harness({ onConfirm = vi.fn(), onCancel = vi.fn(), pending = false, error = null as string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => {
          setOpen(true);
        }}
      >
        Open
      </button>
      <ConfirmDialog
        open={open}
        title="Delete everything?"
        description="This cannot be undone."
        confirmLabel="Delete"
        pending={pending}
        error={error}
        onConfirm={onConfirm}
        onCancel={() => {
          onCancel();
          setOpen(false);
        }}
      />
    </>
  );
}

describe('ConfirmDialog', () => {
  it('is hidden until opened, then labelled by its title and description', async () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    const dialog = screen.getByRole('dialog', { name: 'Delete everything?' });
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
  });

  it('puts focus on Cancel, so a stray Enter cannot confirm', async () => {
    render(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
  });

  it('confirms only when the user presses the destructive button', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    await userEvent.keyboard('{Enter}'); // focus is on Cancel, so this cancels
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('cancels with the Cancel button', async () => {
    const onCancel = vi.fn();
    render(<Harness onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows a server error inside the dialog', async () => {
    render(<Harness error="Incorrect password." />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Incorrect password.');
  });

  it('cannot be confirmed or cancelled while a request is running', async () => {
    const onConfirm = vi.fn();
    render(<Harness onConfirm={onConfirm} pending />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
