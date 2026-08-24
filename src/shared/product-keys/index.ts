/**
 * Product keys — the canonical registry.
 *
 * Every value the app can derive from a client's policies is named here.
 * Three modules read it: product-management (which presents and edits the
 * catalogue), resources/key-manager (which browses and assigns keys), and
 * client-keys (which resolves a client's stored values against it). It is
 * data with no dependencies of its own, so it belongs in the shared layer
 * rather than inside whichever module happened to define it first.
 */
export * from './registry';
export type { ProductKey, ProductKeyCategory } from '../types/product-keys';
