/**
 * The address bar for a module opened from the admin navigation.
 *
 * Only `module` survives. Every other admin URL parameter is a deep link into
 * one module (`clientId`, `resourcesTab`, `formTemplatesClientId`, a
 * submission `type`/`id`, a newsletter campaign), and carrying it into the
 * next module switch reopened whatever it pointed at: clicking Client
 * Management kept opening the last linked client instead of the client list
 * (2026-10-12). Choosing a module from the sidebar opens its default view.
 */
export function moduleSearchParams(module: string): URLSearchParams {
  const next = new URLSearchParams();
  if (module !== 'dashboard') next.set('module', module);
  return next;
}
