/**
 * Resources › Tools: three tool cards; each tool opens as a page of its own
 * with "‹ Back to Tools". The open tool is in the address (?tool=zip).
 */
import React, { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '../../../../ui/button';
import { PageHeader, useUrlState } from '../../../layout/page';
import { BackLink } from '../components/BackLink';

const FormTemplateTool = React.lazy(() =>
  import('./FormTemplateTool').then((m) => ({ default: m.FormTemplateTool })),
);
const ZipEncryptTool = React.lazy(() =>
  import('./ZipEncryptTool').then((m) => ({ default: m.ZipEncryptTool })),
);
const PdfDecryptTool = React.lazy(() =>
  import('./PdfDecryptTool').then((m) => ({ default: m.PdfDecryptTool })),
);

const TOOL_IDS = ['none', 'mapping', 'zip', 'decrypt'] as const;
type ToolId = (typeof TOOL_IDS)[number];

const TOOLS: Array<{
  id: Exclude<ToolId, 'none'>;
  initials: string;
  title: string;
  card: string;
  description: string;
}> = [
  {
    id: 'mapping',
    initials: 'FM',
    title: 'Form Mapping Studio',
    card: 'Map an external PDF form to client data keys so it can be pre-filled.',
    description:
      'Upload provider PDFs, map fields to client data keys, and generate pre-filled forms.',
  },
  {
    id: 'zip',
    initials: 'ZE',
    title: 'Zip & Encrypt',
    card: 'Bundle documents into a password-protected zip to send safely.',
    description:
      'Upload files from your device, organise them into folders, and encrypt them. Files are processed locally on your device.',
  },
  {
    id: 'decrypt',
    initials: 'PD',
    title: 'PDF Decryptor',
    card: 'Remove the password from a PDF you are allowed to open.',
    description:
      'Unlock PDF files so they can be viewed, edited, or printed without entering a password every time. Does not support AES-256 encryption.',
  },
];

interface ToolsTabProps {
  /** Pre-selects a client in the Form Mapping Studio (deep link from a client). */
  formTemplatesClientId?: string;
}

export function ToolsTab({ formTemplatesClientId }: ToolsTabProps) {
  const [toolId, setToolId] = useUrlState<ToolId>('tool', 'none', TOOL_IDS);
  const tool = TOOLS.find((t) => t.id === toolId);

  if (tool) {
    return (
      <div className="flex flex-col gap-4">
        <BackLink label="Back to Tools" onClick={() => setToolId('none')} />
        <PageHeader title={tool.title} description={tool.description} />
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-purple-600" aria-hidden="true" />
            </div>
          }
        >
          {tool.id === 'mapping' && <FormTemplateTool selectedClientId={formTemplatesClientId} />}
          {tool.id === 'zip' && <ZipEncryptTool />}
          {tool.id === 'decrypt' && <PdfDecryptTool />}
        </Suspense>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {TOOLS.map((entry) => (
        <div
          key={entry.id}
          className="flex flex-col gap-3 rounded-xl border border-nw-line bg-white p-5"
        >
          <span
            aria-hidden="true"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-nw-bg text-xs font-semibold text-nw-text-2"
          >
            {entry.initials}
          </span>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-nw-ink">{entry.title}</h2>
            <p className="mt-1 text-sm text-nw-text-3">{entry.card}</p>
          </div>
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => setToolId(entry.id)}
            aria-label={`Open ${entry.title}`}
          >
            Open tool
          </Button>
        </div>
      ))}
    </div>
  );
}
