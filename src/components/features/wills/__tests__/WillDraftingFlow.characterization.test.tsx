/**
 * Characterization net for the `WillDraftingFlow` split.
 * =====================================================
 *
 * 1,605 lines, no tests, and the output is a draft last will and testament.
 * That combination sets the bar: before any of the six wizard steps becomes
 * its own component, the behaviour that decides what ends up in the document
 * has to be written down where a regression would fail loudly.
 *
 * WHAT IS PINNED, AND WHY THESE THINGS
 * ------------------------------------
 * **The step gates.** Each step decides whether Next is enabled, and those
 * rules are the only thing standing between a half-filled form and a submitted
 * draft: a will with no executor named, or with beneficiaries who have no
 * names. Extracting a step into its own component means passing its state and
 * its validity across a new boundary, and a gate wired to the wrong value still
 * renders a perfectly normal-looking button.
 *
 * **The submitted payload.** What the endpoint receives IS the will. Its shape
 * — the executor/alternate split, the guardianship block, the residual
 * instructions — is the deliverable, so it is asserted field by field rather
 * than through a snapshot that would absorb a change silently.
 *
 * **Where it is submitted.** The handler posts to `quote-request/submit` with
 * the public anon key, and carries a comment explaining that this public
 * lead-generation flow must NOT write into an authenticated client's estate
 * records. That is a deliberate boundary, so the destination is pinned too.
 *
 * Written and made green BEFORE the split.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { WillDraftingFlow } from '../WillDraftingFlow';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock('../../../../utils/supabase/info', () => ({
  projectId: 'test-project',
  publicAnonKey: 'test-anon-key',
}));

const onComplete = vi.fn();
const onBack = vi.fn();

/**
 * The prop is `name`, not `firstName` — the component reads
 * `clientDetails.name` into `personalInfo.firstName`. Worth stating: passing a
 * `clientDetails` without these four keys throws inside the first `useMemo`
 * rather than rendering an empty form.
 */
const CLIENT = { name: '', surname: '', email: '', cellphone: '' };

function setup(clientDetails: Partial<typeof CLIENT> = {}) {
  return render(
    <WillDraftingFlow
      clientDetails={{ ...CLIENT, ...clientDetails } as never}
      onComplete={onComplete}
      onBack={onBack}
    />,
  );
}

/** The Next / Save button in the navigation footer. */
function primaryButton(): HTMLButtonElement {
  const buttons = Array.from(document.querySelectorAll('button'));
  const next = buttons.find((b) => /^Next$/.test((b.textContent ?? '').trim()));
  const save = buttons.find((b) => /Save Will Draft|Saving Draft/.test(b.textContent ?? ''));
  const found = next ?? save;
  expect(found, 'no Next or Save button in the footer').toBeTruthy();
  return found as HTMLButtonElement;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ success: true }),
  } as Response);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('step 1 will not advance without an identity', () => {
  it('disables Next on an empty form', () => {
    setup();

    expect(primaryButton().disabled).toBe(true);
  });

  it.each<[string, { first: string; surname?: string }]>([
    ['first name only', { first: 'Zora' }],
    ['first name and surname, no email', { first: 'Zora', surname: 'Mkhize' }],
  ])('stays disabled with %s', (_label, { first, surname }) => {
    const { container } = setup();
    const inputs = Array.from(container.querySelectorAll('input'));
    fireEvent.change(inputs[0], { target: { value: first } });
    if (surname) fireEvent.change(inputs[1], { target: { value: surname } });

    expect(primaryButton().disabled).toBe(true);
  });

  it('enables Next once first name, surname and email are all present', () => {
    const { container } = setup();
    const inputs = Array.from(container.querySelectorAll('input'));
    fireEvent.change(inputs[0], { target: { value: 'Zora' } });
    fireEvent.change(inputs[1], { target: { value: 'Mkhize' } });
    fireEvent.change(inputs[2], { target: { value: '9001010000000' } });
    // Find the email field by type rather than position.
    const email = inputs.find((i) => i.type === 'email');
    fireEvent.change(email!, { target: { value: 'zora@example.co.za' } });

    expect(primaryButton().disabled).toBe(false);
  });

  it('treats whitespace as absent, not as a value', () => {
    // `.trim()` in the gate — a will named "   " is not a signed will.
    //
    // The email is given a REAL address here on purpose. A jsdom
    // `input[type=email]` silently refuses a whitespace-only value, so setting
    // all three fields to spaces leaves the email empty and the gate closes for
    // that reason instead — the test would then pass with every `.trim()`
    // removed, which is the vacuous shape this whole exercise exists to avoid.
    // With a valid email present, the name fields are the only thing holding
    // the gate shut, and they hold it shut only because of `.trim()`.
    const { container } = setup();
    const inputs = Array.from(container.querySelectorAll('input'));
    fireEvent.change(inputs.find((i) => i.type === 'email')!, {
      target: { value: 'zora@example.co.za' },
    });
    fireEvent.change(inputs[0], { target: { value: '   ' } });
    fireEvent.change(inputs[1], { target: { value: '   ' } });

    expect(primaryButton().disabled).toBe(true);
  });

  it('prefills from clientDetails when the caller supplies them', () => {
    const { container } = setup({
      name: 'Zora',
      surname: 'Mkhize',
      email: 'zora@example.co.za',
    });

    const inputs = Array.from(container.querySelectorAll('input'));
    expect(inputs[0].value).toBe('Zora');
    expect(primaryButton().disabled).toBe(false);
  });
});

describe('the back control changes meaning on step 1', () => {
  it('calls onBack rather than moving a step', () => {
    setup();

    const cancel = Array.from(document.querySelectorAll('button')).find((b) =>
      /^Cancel$/.test((b.textContent ?? '').trim()),
    );
    expect(cancel, 'step 1 should offer Cancel, not Back').toBeTruthy();
    fireEvent.click(cancel!);

    expect(onBack).toHaveBeenCalledTimes(1);
  });
});

describe('step 2 will not advance without a named executor', () => {
  function toStep2() {
    const view = setup({ name: 'Zora', surname: 'Mkhize', email: 'zora@example.co.za' });
    fireEvent.click(primaryButton());
    return view;
  }

  it('disables Next until the executor has a name', () => {
    const { container } = toStep2();

    expect(primaryButton().disabled).toBe(true);

    const nameField = container.querySelector('input');
    fireEvent.change(nameField!, { target: { value: 'Thandi Nkosi' } });

    expect(primaryButton().disabled).toBe(false);
  });

  it('offers Back rather than Cancel once past step 1', () => {
    toStep2();

    const back = Array.from(document.querySelectorAll('button')).find((b) =>
      /^Back$/.test((b.textContent ?? '').trim()),
    );
    expect(back).toBeTruthy();
    fireEvent.click(back!);

    expect(onBack).not.toHaveBeenCalled();
  });
});

describe('the submitted draft is the deliverable', () => {
  /** Walk the wizard to the final step with the minimum each gate demands. */
  function completeToFinalStep(container: HTMLElement) {
    const inputs = () => Array.from(container.querySelectorAll('input'));

    // Step 1 — identity
    const first = inputs();
    fireEvent.change(first[0], { target: { value: 'Zora' } });
    fireEvent.change(first[1], { target: { value: 'Mkhize' } });
    fireEvent.change(first.find((i) => i.type === 'email')!, {
      target: { value: 'zora@example.co.za' },
    });
    fireEvent.click(primaryButton());

    // Step 2 — executor
    fireEvent.change(inputs()[0], { target: { value: 'Thandi Nkosi' } });
    fireEvent.click(primaryButton());

    // Step 3 — one named beneficiary
    fireEvent.change(inputs()[0], { target: { value: 'Sipho Mkhize' } });
    fireEvent.click(primaryButton());

    // Step 4 — the minor-children question must be answered either way
    const noButton = Array.from(container.querySelectorAll('button')).find((b) =>
      /^No\b/.test((b.textContent ?? '').trim()),
    );
    expect(noButton, 'step 4 should offer a No answer for minor children').toBeTruthy();
    fireEvent.click(noButton!);
    fireEvent.click(primaryButton());

    // Step 5 — optional
    fireEvent.click(primaryButton());
  }

  it('posts the will to the public quote-request endpoint, not to estate records', async () => {
    // The handler carries a comment saying this public lead-generation flow
    // must not write into an authenticated client's estate records. Pinning the
    // destination keeps that decision from being refactored away quietly.
    const { container } = setup();
    completeToFinalStep(container);

    fireEvent.click(primaryButton());

    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());
    const [url, init] = vi.mocked(globalThis.fetch).mock.calls[0];

    expect(String(url)).toContain('/quote-request/submit');
    expect(String(url)).not.toContain('/fna');
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer test-anon-key',
    });
  });

  it('carries the identity at the top level and the will underneath productDetails', async () => {
    const { container } = setup();
    completeToFinalStep(container);

    fireEvent.click(primaryButton());
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    const body = JSON.parse(
      (vi.mocked(globalThis.fetch).mock.calls[0][1] as RequestInit).body as string,
    );

    expect(body).toMatchObject({
      firstName: 'Zora',
      lastName: 'Mkhize',
      email: 'zora@example.co.za',
      productName: 'Last Will & Testament',
      service: 'estate-planning',
      stage: 'full',
    });
    expect(body.productDetails.willDraft).toBeTruthy();
  });

  it('shapes the will draft the way the document needs it', async () => {
    const { container } = setup();
    completeToFinalStep(container);

    fireEvent.click(primaryButton());
    await waitFor(() => expect(globalThis.fetch).toHaveBeenCalled());

    const { willDraft } = JSON.parse(
      (vi.mocked(globalThis.fetch).mock.calls[0][1] as RequestInit).body as string,
    ).productDetails;

    expect(willDraft.personalInfo).toMatchObject({ firstName: 'Zora', surname: 'Mkhize' });
    expect(willDraft.executor.primary.fullName).toBe('Thandi Nkosi');
    // No alternate was named, so it is null rather than an empty object.
    expect(willDraft.executor.alternate).toBeNull();
    expect(willDraft.beneficiaries[0].fullName).toBe('Sipho Mkhize');
    expect(willDraft.guardianship).toMatchObject({ hasMinorChildren: false });
    expect(willDraft).toHaveProperty('specialBequests');
    expect(willDraft).toHaveProperty('residualInstructions');
    expect(willDraft).toHaveProperty('funeralWishes');
    expect(willDraft.generatedAt).toEqual(expect.any(String));
  });
});
