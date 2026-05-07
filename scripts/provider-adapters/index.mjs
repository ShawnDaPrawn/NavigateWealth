import { allanGrayAdapter } from './allan-gray.mjs';
import { brightRockAdapter } from './brightrock.mjs';

const providerAdapters = [
  allanGrayAdapter,
  brightRockAdapter,
];

export function getProviderAdapter(context = {}) {
  return providerAdapters.find((adapter) => adapter.matches(context)) || null;
}

export function listProviderAdapters() {
  return [...providerAdapters];
}
