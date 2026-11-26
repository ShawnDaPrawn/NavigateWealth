/** Callback addresses for connecting AI agents (OAuth redirect URIs), per tool. */
import type { ConnectionTool } from '../../../../shared/password-manager';

/**
 * Where each tool sends people back after they approve the sign-in, when it is
 * the same for everyone. Claude's is. ChatGPT gives each app its own address
 * (https://chatgpt.com/connector/oauth/<app>), so there is nothing to fill in:
 * pre-filling its old shared address made every ChatGPT sign-in fail on
 * 2026-11-26 with "asked to return to …/connector/oauth/…".
 */
export const KNOWN_CALLBACKS: Record<ConnectionTool, string> = {
  claude: 'https://claude.ai/api/mcp/auth_callback',
  chatgpt: '',
  other: '',
};

export const CALLBACK_HINTS: Record<ConnectionTool, string> = {
  claude: 'Filled in for Claude. Change it only if Claude shows a different one.',
  chatgpt:
    'ChatGPT gives each app its own callback address, like https://chatgpt.com/connector/oauth/… Copy it from your app’s OAuth settings in ChatGPT and paste it here.',
  other:
    'If your tool signs in with OAuth, paste the callback address it shows. Leave it empty to get a token to paste instead.',
};

/** Whether a new connection's callback can work for the tool chosen. */
export function callbackReady(tool: ConnectionTool, callback: string): boolean {
  return tool !== 'chatgpt' || callback.trim().startsWith('https://chatgpt.com/');
}
