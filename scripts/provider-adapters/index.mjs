import { allanGrayAdapter } from './allan-gray.mjs';

const providerAdapters = [
  allanGrayAdapter,
];

export function getProviderAdapter(context = {}) {
  return providerAdapters.find((adapter) => adapter.matches(context)) || null;
}

export function listProviderAdapters() {
  return [...providerAdapters];
}
