/**
 * Proxy module: Re-exports from email-service.tsx
 * WORKAROUND: Proxy file to resolve .ts/.tsx extension mismatch under Deno's strict module resolution.
 * Problem: All imports reference './email-service.ts' but the implementation file is email-service.tsx.
 * Why chosen: The implementation file is too large to safely copy in a single operation.
 * Proper fix: Move all content from email-service.tsx into this file and delete email-service.tsx.
 * Searchable tag: // WORKAROUND: extension-proxy
 */
export * from './email-service.tsx';
