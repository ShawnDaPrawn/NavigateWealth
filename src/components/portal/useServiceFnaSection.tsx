import React, { useCallback, useRef } from 'react';
import { ServiceFnaPanel } from './ServiceFnaPanel';
import type { FnaIntakeDomain } from '@/services/fna-intake-api';

interface UseServiceFnaSectionOptions {
  clientId: string | undefined;
  fnaType: FnaIntakeDomain;
  title: string;
  description: string;
}

export function useServiceFnaSection({
  clientId,
  fnaType,
  title,
  description,
}: UseServiceFnaSectionOptions) {
  const panelRef = useRef<HTMLDivElement>(null);

  const scrollToPanel = useCallback(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  const topContent =
    clientId ? (
      <ServiceFnaPanel
        ref={panelRef}
        clientId={clientId}
        fnaType={fnaType}
        title={title}
        description={description}
      />
    ) : null;

  return { topContent, scrollToPanel };
}
