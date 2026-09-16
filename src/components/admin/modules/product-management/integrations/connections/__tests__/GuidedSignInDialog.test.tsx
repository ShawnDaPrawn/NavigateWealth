/**
 * Guided sign-in — the three facts, and the order they are used in
 * ================================================================
 *
 * The dialog collects a portal address, a username and a password, saves
 * whatever changed, and starts a test. The ordering matters and is easy to get
 * wrong: starting the test before the new credentials are saved would test the
 * OLD ones and report a pass on details the adviser has just replaced. That is
 * the main thing pinned here.
 *
 * Also pinned: the password field is never pre-filled from anything, and the
 * one-time PIN input only exists while the worker is actually waiting for one.
 */
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@/test/utils';
import { GuidedSignInDialog } from '../GuidedSignInDialog';
import type { PortalProviderConnection, PortalSyncJob } from '../../../types';

const connection: PortalProviderConnection = {
  providerId: 'p1',
  providerName: 'Allan Gray',
  state: 'untested',
  categoryId: 'risk_planning',
  credentialProfileId: 'allan-gray-env',
  loginUrl: 'https://portal.example/login',
  hasCredentials: true,
};

function makeProps(over: Partial<Parameters<typeof GuidedSignInDialog>[0]> = {}) {
  return {
    connection,
    open: true,
    onOpenChange: vi.fn(),
    onSaveLoginUrl: vi.fn().mockResolvedValue(undefined),
    onSaveCredentials: vi.fn().mockResolvedValue(undefined),
    onStartTest: vi.fn().mockResolvedValue(undefined),
    onSubmitOtp: vi.fn().mockResolvedValue(undefined),
    isSaving: false,
    isStartingTest: false,
    isSubmittingOtp: false,
    ...over,
  } as Parameters<typeof GuidedSignInDialog>[0];
}

const job = (over: Partial<PortalSyncJob> = {}): PortalSyncJob =>
  ({
    id: 'job-1',
    providerId: 'p1',
    providerName: 'Allan Gray',
    categoryId: 'risk_planning',
    status: 'running',
    flowId: 'flow-1',
    credentialProfileId: 'allan-gray-env',
    connectionTest: true,
    createdAt: '2026-09-16T00:00:00.000Z',
    updatedAt: '2026-09-16T00:00:00.000Z',
    ...over,
  }) as PortalSyncJob;

describe('GuidedSignInDialog — what it collects', () => {
  it('shows the stored sign-in address so it can be corrected', () => {
    render(<GuidedSignInDialog {...makeProps()} />);
    const input = screen.getByLabelText('Portal sign-in address') as HTMLInputElement;
    expect(input.value).toBe('https://portal.example/login');
  });

  it('never pre-fills the password, which is not readable back anyway', () => {
    render(<GuidedSignInDialog {...makeProps()} />);
    const password = screen.getByLabelText('Provider portal password') as HTMLInputElement;
    expect(password.value).toBe('');
  });

  it('says plainly that nothing will be read or changed', () => {
    render(<GuidedSignInDialog {...makeProps()} />);
    expect(screen.getByText(/no policy is changed/i)).toBeDefined();
  });

  it('says credentials are already stored, so blank fields are not a mistake', () => {
    render(<GuidedSignInDialog {...makeProps()} />);
    expect(screen.getByText(/already stored for this provider/i)).toBeDefined();
  });
});

describe('GuidedSignInDialog — starting a test', () => {
  it('tests the stored details without re-saving anything when nothing was edited', async () => {
    const props = makeProps();
    render(<GuidedSignInDialog {...props} />);

    fireEvent.click(screen.getByText('Test sign-in'));

    await waitFor(() => expect(props.onStartTest).toHaveBeenCalledTimes(1));
    expect(props.onSaveLoginUrl).not.toHaveBeenCalled();
    expect(props.onSaveCredentials).not.toHaveBeenCalled();
  });

  it('saves new credentials BEFORE testing, or it would test the old ones', async () => {
    const order: string[] = [];
    const props = makeProps({
      onSaveCredentials: vi.fn().mockImplementation(async () => {
        order.push('save');
      }),
      onStartTest: vi.fn().mockImplementation(async () => {
        order.push('test');
      }),
    });
    render(<GuidedSignInDialog {...props} />);

    fireEvent.change(screen.getByLabelText('Provider portal username'), {
      target: { value: 'firm@example.co.za' },
    });
    fireEvent.change(screen.getByLabelText('Provider portal password'), {
      target: { value: 'new-password' },
    });
    fireEvent.click(screen.getByText('Test sign-in'));

    await waitFor(() => expect(order).toEqual(['save', 'test']));
  });

  it('saves a corrected sign-in address before testing against it', async () => {
    const props = makeProps();
    render(<GuidedSignInDialog {...props} />);

    fireEvent.change(screen.getByLabelText('Portal sign-in address'), {
      target: { value: 'https://portal.example/new-login' },
    });
    fireEvent.click(screen.getByText('Test sign-in'));

    await waitFor(() =>
      expect(props.onSaveLoginUrl).toHaveBeenCalledWith('https://portal.example/new-login'),
    );
  });

  it('does not test the old details when saving the new ones failed', async () => {
    const props = makeProps({
      onSaveCredentials: vi.fn().mockRejectedValue(new Error('save failed')),
    });
    render(<GuidedSignInDialog {...props} />);

    fireEvent.change(screen.getByLabelText('Provider portal username'), {
      target: { value: 'firm@example.co.za' },
    });
    fireEvent.change(screen.getByLabelText('Provider portal password'), {
      target: { value: 'new-password' },
    });
    fireEvent.click(screen.getByText('Test sign-in'));

    await waitFor(() => expect(props.onSaveCredentials).toHaveBeenCalled());
    expect(props.onStartTest).not.toHaveBeenCalled();
  });

  it('does not test the old address when saving a corrected one failed', async () => {
    const props = makeProps({
      onSaveLoginUrl: vi.fn().mockRejectedValue(new Error('flow not loaded')),
    });
    render(<GuidedSignInDialog {...props} />);

    fireEvent.change(screen.getByLabelText('Portal sign-in address'), {
      target: { value: 'https://portal.example/new-login' },
    });
    fireEvent.click(screen.getByText('Test sign-in'));

    await waitFor(() => expect(props.onSaveLoginUrl).toHaveBeenCalled());
    expect(props.onStartTest).not.toHaveBeenCalled();
  });

  it('cannot start without an address, which the server would refuse anyway', () => {
    const props = makeProps({ connection: { ...connection, loginUrl: '' } });
    render(<GuidedSignInDialog {...props} />);

    const button = screen.getByText('Test sign-in').closest('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it('cannot start on a provider with no stored credentials until some are typed', () => {
    const props = makeProps({ connection: { ...connection, hasCredentials: false } });
    render(<GuidedSignInDialog {...props} />);

    const button = screen.getByText('Test sign-in').closest('button') as HTMLButtonElement;
    expect(button.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText('Provider portal username'), {
      target: { value: 'firm@example.co.za' },
    });
    fireEvent.change(screen.getByLabelText('Provider portal password'), {
      target: { value: 'pw' },
    });
    expect(button.disabled).toBe(false);
  });
});

describe('GuidedSignInDialog — while the test runs', () => {
  it('asks for the one-time PIN only when the worker is waiting for one', () => {
    render(<GuidedSignInDialog {...makeProps({ job: job({ status: 'running' }) })} />);
    expect(screen.queryByLabelText('One-time PIN')).toBeNull();
  });

  it('collects the PIN and hands it over', async () => {
    const props = makeProps({ job: job({ status: 'waiting_for_otp' }) });
    render(<GuidedSignInDialog {...props} />);

    fireEvent.change(screen.getByLabelText('One-time PIN'), { target: { value: '445566' } });
    fireEvent.click(screen.getByText('Submit PIN'));

    await waitFor(() => expect(props.onSubmitOtp).toHaveBeenCalledWith('445566'));
  });

  it('reports the failure in the provider’s own words', () => {
    render(
      <GuidedSignInDialog
        {...makeProps({
          connection: {
            ...connection,
            state: 'failed',
            message: 'Your password has expired.',
          },
        })}
      />,
    );
    expect(screen.getByText('Your password has expired.')).toBeDefined();
  });

  it('confirms success without making the adviser read a job log', () => {
    render(
      <GuidedSignInDialog {...makeProps({ connection: { ...connection, state: 'connected' } })} />,
    );
    expect(screen.getByText(/Signed in to Allan Gray successfully/)).toBeDefined();
  });
});
