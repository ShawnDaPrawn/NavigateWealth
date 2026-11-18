/**
 * Copies text for the "Share Position" and "Copy boilerplate" buttons. Uses
 * the Clipboard API where the browser allows it, and falls back to the
 * selection-based copy the live Careers page used. Resolves false when
 * neither works, so the button never claims a copy that did not happen.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall back below */
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.position = 'fixed';
  area.style.opacity = '0';
  document.body.appendChild(area);
  area.select();
  let copied: boolean;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  document.body.removeChild(area);
  return copied;
}
