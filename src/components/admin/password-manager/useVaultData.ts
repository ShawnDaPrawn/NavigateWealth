import { useCallback, useEffect, useState } from 'react';
import type { Collection, VaultSummary } from '../../../shared/password-manager';
import type { Broker } from '../../../shared/broker-operations';
import { getSetup } from './portalApi';
import { isVaultLocked, listCollections, listCredentials } from './vaultApi';

/** Every credential and collection, loaded once the vault is open. */
export function useVaultData(enabled: boolean) {
  const [items, setItems] = useState<VaultSummary[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [directory, setDirectory] = useState<Broker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    setError('');
    listCollections()
      .then((rows) => {
        if (active) setCollections(rows);
      })
      .catch(() => {
        /* The rail falls back to "All items" when collections cannot load. */
      });
    listCredentials()
      .then(async (rows) => {
        if (!active) return;
        setItems(rows);
        if (rows.some((row) => row.portal)) {
          const setup = await getSetup().catch(() => null);
          if (active && setup) setDirectory(setup.brokers);
        }
      })
      .catch((e) => {
        if (active && !isVaultLocked(e))
          setError('Could not load credentials. Check your access and try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled, generation]);

  const reload = useCallback(() => setGeneration((n) => n + 1), []);
  return { items, collections, directory, loading, error, reload };
}

export type VaultData = ReturnType<typeof useVaultData>;
