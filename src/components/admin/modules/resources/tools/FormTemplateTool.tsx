import React, { Suspense, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { FileSpreadsheet, ChevronRight, Loader2 } from 'lucide-react';

const FormTemplatesModule = React.lazy(() =>
  import('../../form-prefill/FormTemplatesModule').then((m) => ({
    default: m.FormTemplatesModule,
  })),
);

function DialogFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
    </div>
  );
}

interface FormTemplateToolProps {
  selectedClientId?: string;
}

export function FormTemplateTool({ selectedClientId }: FormTemplateToolProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="contents">
      <Card
        className="group cursor-pointer border-2 border-dashed transition-shadow hover:shadow-md hover:border-purple-500/50"
        onClick={() => setIsOpen(true)}
      >
        <CardHeader>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
            <FileSpreadsheet className="h-6 w-6 text-purple-600" />
          </div>
          <CardTitle>Form Mapping Studio</CardTitle>
          <CardDescription>
            Upload provider PDFs, map fields to client data keys, and generate pre-filled forms.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Build reusable PDF templates once, then preview and download filled versions for any
            client.
          </p>
        </CardContent>
        <CardFooter>
          <Button
            variant="ghost"
            className="w-full justify-start pl-0 text-purple-600 transition-all group-hover:pl-2"
          >
            Open Tool <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-[min(96vw,72rem)] max-w-5xl overflow-hidden p-0 gap-0">
          <DialogHeader className="border-b bg-slate-50/80 px-6 py-5 pr-14">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-purple-600" />
              Form Mapping Studio
            </DialogTitle>
            <DialogDescription>
              Manage reusable PDF templates, map fields to client data, and generate filled forms.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[min(82vh,900px)] overflow-y-auto bg-slate-50/40 px-6 py-6">
            <Suspense fallback={<DialogFallback />}>
              <FormTemplatesModule selectedClientId={selectedClientId} />
            </Suspense>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
