/**
 * Newsletter Studio — deferred loader for the shared TipTap editor.
 *
 * Cross-module dependency: newsletter → publications (public barrel surface).
 * The editor is owned by publications; importing it through the barrel keeps
 * the §3.1 boundary, and the dynamic import keeps `vendor-editor` off this
 * module's initial chunk.
 *
 * Deliberately NOT `React.lazy` + `<Suspense>`: TipTap's `useEditor` creates
 * the ProseMirror instance during render and schedules its destruction when
 * a render is discarded. A Suspense boundary resolving a lazy component does
 * exactly that, so the first committed effect ran against a destroyed editor
 * (`DOMSerializer.fromSchema` on a null schema). Resolving the chunk in an
 * effect and only then mounting the editor sidesteps the discarded render.
 */
import { useEffect, useState, type ComponentProps, type ComponentType } from 'react';
import { Skeleton } from '../../../../ui/skeleton';
import type { RichTextEditor as SharedRichTextEditor } from '../../publications';

type EditorProps = ComponentProps<typeof SharedRichTextEditor>;
type EditorComponent = ComponentType<EditorProps>;

let cached: EditorComponent | null = null;
let loading: Promise<EditorComponent> | null = null;

function loadEditor(): Promise<EditorComponent> {
  if (cached) return Promise.resolve(cached);
  loading ??= import('../../publications').then((m) => {
    cached = m.RichTextEditor;
    return cached;
  });
  return loading;
}

export function LazyRichTextEditor({
  fallbackHeight = 'h-80',
  ...props
}: EditorProps & { fallbackHeight?: string }) {
  const [Editor, setEditor] = useState<EditorComponent | null>(() => cached);

  useEffect(() => {
    if (Editor) return;
    let alive = true;
    loadEditor().then((component) => {
      if (alive) setEditor(() => component);
    });
    return () => {
      alive = false;
    };
  }, [Editor]);

  if (!Editor) {
    return (
      <Skeleton
        className={`${fallbackHeight} w-full rounded-xl`}
        data-testid="rich-text-editor-loading"
      />
    );
  }
  return <Editor {...props} />;
}
