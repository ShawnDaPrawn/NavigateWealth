import { useEffect, useState } from 'react';
import { api } from '../../../utils/api/client';
import { ops, options } from './portalApi';
import type { PortalCheckpoint } from '../../../shared/broker-operations';
export default function PortalInspector({ id }: { id: string }) {
  const [view, setView] = useState<PortalCheckpoint | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const d = await api.get<{ checkpoint: PortalCheckpoint | null }>(
          ops + '/runs/' + id + '/checkpoint',
          options,
        );
        if (active) {
          setView(d.checkpoint);
          setError('');
        }
      } catch {
        if (active) setError('Could not load portal checkpoint.');
      } finally {
        pending = false;
      }
    };
    void load();
    const timer = setInterval(load, 6000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [id]);
  if (error) return <p role="alert">{error}</p>;
  if (!view) return <p role="status">Waiting for the first provider checkpoint.</p>;
  return (
    <figure className="rounded-lg border p-3">
      <figcaption className="mb-2 text-xs">
        Redacted portal layout · {view.stage} · {view.origin} ·{' '}
        {new Date(view.updatedAt).toLocaleTimeString()}
      </figcaption>
      <div
        className="relative aspect-video overflow-hidden rounded bg-muted"
        role="img"
        aria-label={'Redacted provider page during ' + view.stage}
      >
        {view.controls.map((r, i) => (
          <span
            key={i}
            className="absolute overflow-hidden rounded-sm border bg-background text-[9px] text-muted-foreground"
            style={{
              left: r.x + '%',
              top: r.y + '%',
              width: r.width + '%',
              height: r.height + '%',
            }}
          >
            {r.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
