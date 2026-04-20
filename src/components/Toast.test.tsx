import { describe, it, expect } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ToastProvider, useToast } from './Toast';

const Trigger: React.FC = () => {
  const toast = useToast();
  return (
    <div>
      <button onClick={() => toast.success('Saved!')}>fire-success</button>
      <button onClick={() => toast.error('Broke!')}>fire-error</button>
      <button onClick={() => toast.info('FYI')}>fire-info</button>
    </div>
  );
};

describe('Toast', () => {
  it('renders a success toast with role="status"', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await user.click(screen.getByText('fire-success'));
    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('Saved!');
  });

  it('renders an error toast with role="alert"', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await user.click(screen.getByText('fire-error'));
    const toast = await screen.findByRole('alert');
    expect(toast).toHaveTextContent('Broke!');
  });

  it('can be dismissed via the close button', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    );
    await user.click(screen.getByText('fire-info'));
    const toast = await screen.findByRole('status');
    expect(toast).toHaveTextContent('FYI');
    await user.click(screen.getByLabelText('Dismiss notification'));
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('throws a helpful error if used outside the provider', () => {
    // Suppress React's error-boundary log for this intentional throw.
    const originalError = console.error;
    console.error = () => {};
    try {
      expect(() =>
        act(() => {
          render(<Trigger />);
        }),
      ).toThrow(/ToastProvider/);
    } finally {
      console.error = originalError;
    }
  });
});
