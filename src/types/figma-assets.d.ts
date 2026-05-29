/**
 * Ambient declaration for Figma-exported asset imports.
 *
 * Components import these as `import logo from 'figma:asset/<hash>.png'`.
 * At build time the `figma-asset-resolver` Vite plugin (see vite.config.ts)
 * rewrites the specifier to the real file under `src/assets`, and Vite's asset
 * pipeline turns the default export into the resolved URL string. TypeScript
 * has no knowledge of that virtual module, so we declare it here.
 */
declare module 'figma:asset/*' {
  const src: string;
  export default src;
}
