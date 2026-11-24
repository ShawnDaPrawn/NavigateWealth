import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';

/** Shows text exactly as an AI agent receives it. */
export function PreviewDialog({
  title,
  text,
  onClose,
}: {
  title: string;
  text: string;
  onClose: () => void;
}) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            This is the exact text an AI agent receives. It never includes a password.
          </DialogDescription>
        </DialogHeader>
        <pre className="rounded-md border border-nw-line bg-nw-paper p-4 text-[13px] leading-relaxed whitespace-pre-wrap text-nw-ink">
          {text}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
