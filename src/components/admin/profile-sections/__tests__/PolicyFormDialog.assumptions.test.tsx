/**
 * PolicyFormDialog — assumptions-tool remount pin.
 *
 * The Assumptions dialog holds the growth/escalation rates an adviser is part
 * way through entering. Those live in state INSIDE the assumptions component,
 * so that component's identity has to survive a re-render of the policy form
 * around it. It did not: the component was declared in PolicyFormDialog's body,
 * so every parent render produced a new component type, React unmounted the
 * open dialog and mounted a fresh one, and `open` went back to false.
 *
 * The trigger is ordinary: typing in any other field on the form calls
 * handleFieldChange -> setFormData -> parent render. So an adviser who opened
 * Assumptions, then touched another field, had the dialog vanish and their
 * half-entered rates discarded with no message.
 *
 * These tests drive the real dialog rather than asserting on component
 * identity, so they keep holding if the fix is implemented some other way.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/utils';

const RETIREMENT_FIELDS = [
  {
    id: 'ret_pre_4',
    name: 'Estimated Maturity Value',
    type: 'currency',
    required: false,
    keyId: 'retirement_estimated_maturity_value',
  },
  {
    id: 'ret_pre_5',
    name: 'Retirement Age',
    type: 'number',
    required: false,
    keyId: 'retirement_age',
  },
  {
    id: 'ret_pre_3',
    name: 'Current Value',
    type: 'currency',
    required: true,
    keyId: 'retirement_fund_value',
  },
];

vi.mock('../../../../utils/api', () => ({
  api: {
    get: vi.fn(async (url: string) => {
      if (url.includes('/integrations/schemas')) return { fields: RETIREMENT_FIELDS };
      if (url.includes('/integrations/providers')) return { providers: [] };
      return {};
    }),
    post: vi.fn(async () => ({})),
    put: vi.fn(async () => ({})),
  },
}));

vi.mock('../PolicyDocumentUpload', () => ({
  PolicyDocumentUpload: () => null,
}));

import { PolicyFormDialog } from '../PolicyFormDialog';

function renderDialog() {
  return render(
    <PolicyFormDialog
      isOpen
      onClose={() => {}}
      categorySubtabId="retirement"
      categoryName="Retirement"
      clientId="client-1"
      editingPolicy={{
        id: 'pol-1',
        categoryId: 'retirement_pre',
        providerId: 'prov-1',
        providerName: 'Acme Life',
        data: {},
      }}
      onSave={() => {}}
    />,
  );
}

/** Opens the assumptions dialog and waits for its content. */
async function openAssumptions() {
  const trigger = await screen.findByRole('button', { name: /assumptions/i });
  fireEvent.click(trigger);
  await screen.findByText(/Retirement Assumptions/i);
}

describe('PolicyFormDialog assumptions tool', () => {
  beforeEach(() => vi.clearAllMocks());

  it('opens the assumptions dialog', async () => {
    renderDialog();
    await openAssumptions();
    expect(screen.getByText(/Retirement Assumptions/i)).toBeTruthy();
  });

  it('stays open when another field on the form changes', async () => {
    renderDialog();
    await openAssumptions();

    // Ordinary editing on the form behind the dialog: this is what used to
    // remount the tool and slam the dialog shut.
    const age = screen.getByLabelText(/Retirement Age/i);
    fireEvent.change(age, { target: { value: '65' } });

    await waitFor(() => {
      expect(screen.getByText(/Retirement Assumptions/i)).toBeTruthy();
    });
  });

  it('keeps half-entered growth and escalation rates across that re-render', async () => {
    renderDialog();
    await openAssumptions();

    const growth = screen.getByLabelText(/Annual Growth Rate/i);
    const escalation = screen.getByLabelText(/Annual Premium Escalation/i);
    fireEvent.change(growth, { target: { value: '12' } });
    fireEvent.change(escalation, { target: { value: '5' } });

    const age = screen.getByLabelText(/Retirement Age/i);
    fireEvent.change(age, { target: { value: '65' } });

    // The rates the adviser typed must survive; a remount reset them to the
    // form's stored values (10 and 0).
    await waitFor(() => {
      expect((screen.getByLabelText(/Annual Growth Rate/i) as HTMLInputElement).value).toBe('12');
    });
    expect((screen.getByLabelText(/Annual Premium Escalation/i) as HTMLInputElement).value).toBe(
      '5',
    );
  });
});
