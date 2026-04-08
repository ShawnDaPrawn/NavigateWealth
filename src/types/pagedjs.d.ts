declare module 'pagedjs' {
  export class Previewer {
    constructor(options?: Record<string, unknown>);
    preview(
      content?: DocumentFragment,
      stylesheets?: Array<string | Record<string, string>>,
      renderTo?: HTMLElement,
    ): Promise<{
      pages: unknown[];
      size?: unknown;
      performance?: number;
    }>;
  }
}
