import { allanGrayAdapter } from './allan-gray.mjs';
import { brightRockAdapter } from './brightrock.mjs';
import { capitalLegacyAdapter } from './capital-legacy.mjs';

const providerAdapters = [
  allanGrayAdapter,
  brightRockAdapter,
  capitalLegacyAdapter,
];

export function getProviderAdapter(context = {}) {
  return providerAdapters.find((adapter) => adapter.matches(context)) || null;
}

export function listProviderAdapters() {
  return [...providerAdapters];
}
