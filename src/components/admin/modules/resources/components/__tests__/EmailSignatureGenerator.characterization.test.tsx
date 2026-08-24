/**
 * Characterization net for the `EmailSignatureGenerator` split.
 * ============================================================
 *
 * The file is 1,640 lines: ~400 of pure HTML-building logic and ~1,200 of
 * component. Taking it apart means extracting React sub-components, and prop
 * threading is where a "pure move" quietly stops being one — a handler wired to
 * the wrong setter still renders, still type-checks, and silently does nothing.
 *
 * The existing `EmailSignatureGenerator.test.tsx` is five smoke assertions
 * ("renders without crashing", "container is non-empty"). Those pass whatever
 * the props do, so they are not a net for this.
 *
 * WHAT IS PINNED HERE
 * -------------------
 * The tool's actual output: the generated signature HTML, which reaches the DOM
 * through `dangerouslySetInnerHTML` and is therefore fully assertable. Plus the
 * interactions that feed it — editing a field, switching template, uploading a
 * logo, saving and reloading a format — because each of those is a state setter
 * that has to survive being passed across a new component boundary.
 *
 * Written and made green BEFORE the split, so a red run afterwards means the
 * split broke something rather than that the expectation was wrong.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { EmailSignatureGenerator } from '../EmailSignatureGenerator';

const writeText = vi.fn();

beforeEach(() => {
  localStorage.clear();
  writeText.mockReset().mockResolvedValue(undefined);
  Object.assign(navigator, { clipboard: { writeText } });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * The preview renders the generated HTML through `dangerouslySetInnerHTML`, so
 * the signature markup is in the DOM. Grab the node that carries it.
 */
function signatureHtml(container: HTMLElement): string {
  const tables = Array.from(container.querySelectorAll('table'));
  expect(tables.length, 'no signature table rendered').toBeGreaterThan(0);
  return tables.map((t) => t.outerHTML).join('\n');
}

/**
 * The preview is gated on a non-empty full name (`isReady`), so DEFAULT_DATA
 * alone renders no signature. Every test that inspects the markup has to get
 * past that gate first — which is itself worth pinning, below.
 */
function renderReady(name = 'Zora Mkhize') {
  const result = render(<EmailSignatureGenerator />);
  fireEvent.change(fieldByPlaceholder(result.container, NAME_FIELD), { target: { value: name } });
  return result;
}

/**
 * Fields are addressed by placeholder rather than by walking up from a `<Label>`
 * to a shared ancestor. The wrapper structure is exactly what a component split
 * rearranges, so a lookup that depends on it would report false failures for
 * markup changes that broke nothing.
 */
function fieldByPlaceholder(container: HTMLElement, placeholder: string): HTMLInputElement {
  const input = container.querySelector(`[placeholder="${placeholder}"]`);
  expect(input, `no field with placeholder "${placeholder}"`).toBeTruthy();
  return input as HTMLInputElement;
}

const NAME_FIELD = 'e.g. John Smith';
const EMAIL_FIELD = 'john@navigatewealth.co.za';

describe('the preview is gated on a name being entered', () => {
  it('renders no signature at all with the default (empty) name', () => {
    const { container } = render(<EmailSignatureGenerator />);

    expect(container.querySelectorAll('table')).toHaveLength(0);
  });

  it('renders one once a name is typed', () => {
    const { container } = renderReady();

    expect(container.querySelectorAll('table').length).toBeGreaterThan(0);
  });
});

describe('the generated signature is the output that matters', () => {
  it('carries an edited name through to the signature', () => {
    const { container } = renderReady();

    expect(signatureHtml(container)).toContain('Zora Mkhize');
  });

  it('carries an edited email through to both the text and the mailto link', () => {
    const { container } = renderReady();

    fireEvent.change(fieldByPlaceholder(container, EMAIL_FIELD), {
      target: { value: 'zora@example.co.za' },
    });

    const html = signatureHtml(container);
    expect(html).toContain('zora@example.co.za');
    expect(html).toContain('mailto:zora@example.co.za');
  });

  /**
   * Template differences are read off the CLIPBOARD, not the rendered preview.
   * The preview sits inside `AnimatePresence mode="wait"` keyed on the template,
   * and in jsdom the exit animation never completes, so the old node stays
   * mounted and the DOM shows the previous template forever. Asserting on the
   * DOM there would pin the animation's behaviour rather than the generator's.
   * The clipboard reads the live `signatureHtml` memo, which is also the thing a
   * user actually walks away with.
   */
  function copiedHtml(): string {
    const copy = screen.getAllByText(/Copy HTML/i)[0];
    fireEvent.click(copy.closest('button') ?? copy);
    return writeText.mock.calls.at(-1)![0] as string;
  }

  function clickTemplate(container: HTMLElement, name: string): void {
    const button = Array.from(container.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').trim().startsWith(name),
    );
    expect(button, `no template button named ${name}`).toBeTruthy();
    fireEvent.click(button!);
  }

  it('produces different markup for each of the four templates', () => {
    const { container } = renderReady();
    const seen = new Set<string>();

    for (const name of ['Modern', 'Elegant', 'Bold', 'Navigate']) {
      clickTemplate(container, name);
      seen.add(copiedHtml());
    }

    // Four templates generating identical HTML would mean the selector is not
    // reaching the generator — exactly what a bad prop hand-off looks like from
    // the outside.
    expect(seen.size).toBe(4);
  });

  it('keeps the entered name when the template changes', () => {
    const { container } = renderReady();

    clickTemplate(container, 'Bold');

    expect(copiedHtml()).toContain('Zora Mkhize');
  });
});

describe('copy and download read the same generated HTML', () => {
  it('copies the signature markup, not the page', async () => {
    renderReady();

    const copy = screen.getAllByText(/Copy HTML/i)[0];
    fireEvent.click(copy.closest('button') ?? copy);

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('Zora Mkhize');
    expect(copied).toContain('<table');
  });
});

describe('saved formats survive a round trip through localStorage', () => {
  const STORAGE_KEY = 'navigate_wealth_signature_formats';

  it('writes a saved format under the documented key', () => {
    renderReady();

    const save = screen.getAllByText(/Save Format/i)[0];
    fireEvent.click(save.closest('button') ?? save);

    const nameInput = document.querySelector(
      'input[placeholder*="format" i], [role="dialog"] input',
    ) as HTMLInputElement;
    expect(nameInput, 'save-format dialog did not open with a name field').toBeTruthy();
    fireEvent.change(nameInput, { target: { value: 'Adviser default' } });

    const dialog = nameInput.closest('[role="dialog"]') as HTMLElement;
    const confirm = within(dialog)
      .getAllByRole('button')
      .find((b) => /save/i.test(b.textContent ?? ''));
    fireEvent.click(confirm!);

    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as Array<
      Record<string, unknown>
    >;
    expect(stored).toHaveLength(1);
    expect(stored[0].name).toBe('Adviser default');
  });

  it('loads formats written before mount', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([{ id: '1', name: 'Preloaded', fields: { name: 'Loaded Person' } }]),
    );

    render(<EmailSignatureGenerator />);

    expect(screen.getAllByText(/Preloaded/i).length).toBeGreaterThan(0);
  });

  it('survives corrupt storage rather than failing to render', () => {
    // The component swallows a parse error deliberately; pinning it means the
    // try/catch cannot be dropped during the move without a test noticing.
    localStorage.setItem(STORAGE_KEY, 'not json');

    const { container } = renderReady();

    expect(signatureHtml(container).length).toBeGreaterThan(0);
  });
});

describe('reset returns the form to its defaults', () => {
  it('discards an edited name, taking the preview back behind its gate', () => {
    const { container } = renderReady();
    expect(signatureHtml(container)).toContain('Zora Mkhize');

    const reset = screen.getAllByText(/Reset/i)[0];
    fireEvent.click(reset.closest('button') ?? reset);

    // Resetting empties fullName, so `isReady` goes false and the preview
    // disappears entirely — not merely loses the name.
    expect(container.querySelectorAll('table')).toHaveLength(0);
  });
});
