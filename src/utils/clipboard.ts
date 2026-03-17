import copy from 'copy-to-clipboard';

/**
 * Copy text to clipboard using copy-to-clipboard (execCommand) first,
 * falling back to navigator.clipboard.writeText if needed.
 * 
 * We prioritize the synchronous 'copy-to-clipboard' library (execCommand)
 * because it preserves the "user activation" state required by browsers.
 * The async navigator.clipboard API can lose this state if we await it first.
 *
 * @param text - Text to copy
 * @returns Promise that resolves when copy is successful
 */
export async function copyToClipboard(text: string): Promise<void> {
  // 1. Try synchronous execCommand via library
  // This is most likely to work in iframes and during click events
  try {
    const success = copy(text, {
      debug: false,
      message: 'Press #{key} to copy',
    });
    if (success) {
      return;
    }
  } catch (err) {
    // Library failed, try fallback
  }

  // 2. Fallback to modern Async Clipboard API
  // This might work in some contexts where execCommand is blocked but API is allowed
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (err) {
      throw new Error('All clipboard methods failed');
    }
  }

  throw new Error('Clipboard not supported');
}
