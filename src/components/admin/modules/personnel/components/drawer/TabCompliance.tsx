import { useState } from 'react';
import { Button } from '../../../../../ui/button';
import { Checkbox } from '../../../../../ui/checkbox';
import { Switch } from '../../../../../ui/switch';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { Shield, Upload, FileText, ExternalLink } from 'lucide-react';
import { SoonBadge } from '../../../../layout/page';
import { Personnel } from '../../types';

interface TabComplianceProps {
  selectedPersonnel: Personnel;
}

/**
 * Fit & proper status and compliance documents.
 *
 * Upload stays switched off: `POST /personnel/:id/documents` only records a
 * document that already has a URL; there is no endpoint that stores a staff
 * member's file. The dialog (design PE-Upload) is built so it only needs wiring.
 */
export function TabCompliance({ selectedPersonnel }: TabComplianceProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Shield className="h-5 w-5 text-purple-600" aria-hidden="true" />
          Fit &amp; proper status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-4">
          <div>
            <div className="font-medium" id="fsp-rep-label">
              FSP representative
            </div>
            <div className="text-sm text-muted-foreground">Authorised to give advice</div>
          </div>
          <Switch
            checked={selectedPersonnel.fscaStatus === 'active'}
            aria-labelledby="fsp-rep-label"
          />
        </div>

        <div className="space-y-4">
          <h4 className="text-sm font-medium">Required qualifications</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded border p-3">
              <span className="text-sm">RE5 certificate</span>
              <Checkbox
                checked={selectedPersonnel.qualifications?.re5}
                aria-label="RE5 certificate"
              />
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <span className="text-sm">CFP® designation</span>
              <Checkbox
                checked={selectedPersonnel.qualifications?.cfp}
                aria-label="CFP® designation"
              />
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <span className="text-sm">Class of business</span>
              <Checkbox
                checked={selectedPersonnel.qualifications?.cob}
                aria-label="Class of business"
              />
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-sm font-medium">Compliance documents</h4>
            <Button size="sm" variant="outline" disabled>
              <Upload className="h-3 w-3" aria-hidden="true" /> Upload <SoonBadge />
            </Button>
          </div>

          <div className="space-y-2">
            {selectedPersonnel.documents?.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between rounded border bg-slate-50 p-3"
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" aria-hidden="true" />
                  <span className="text-sm font-medium">{doc.name}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    aria-label={`Open document ${doc.name}`}
                    disabled={!doc.url}
                    onClick={() => window.open(doc.url, '_blank', 'noopener,noreferrer')}
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))}
            {!selectedPersonnel.documents?.length && (
              <div className="text-sm text-muted-foreground italic">No documents uploaded</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const COMPLIANCE_DOCUMENT_TYPES = [
  { value: 'qualification', label: 'Qualification' },
  { value: 're5', label: 'RE5 certificate' },
  { value: 'cfp', label: 'CFP® designation' },
  { value: 'cob', label: 'Class of business' },
  { value: 'other', label: 'Other' },
] as const;

const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

interface UploadComplianceDocumentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (input: { type: string; name: string; file: File }) => void;
  submitting?: boolean;
}

/** Upload compliance document (design PE-Upload): type, name, file. */
export function UploadComplianceDocumentDialog({
  open,
  onOpenChange,
  onUpload,
  submitting = false,
}: UploadComplianceDocumentDialogProps) {
  const [type, setType] = useState<string>('qualification');
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ name?: string; file?: string }>({});

  const submit = () => {
    const found: { name?: string; file?: string } = {};
    if (!name.trim()) found.name = 'Enter a name for the document';
    if (!file) found.file = 'Choose a file';
    else if (!ACCEPTED_TYPES.includes(file.type)) found.file = 'Choose a PDF, JPG or PNG file';
    setErrors(found);
    if (found.name || found.file || !file) return;
    onUpload({ type, name: name.trim(), file });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!submitting) onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload compliance document</DialogTitle>
          <DialogDescription>
            Add a qualification or other fit &amp; proper record.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="compliance-doc-type">Document type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="compliance-doc-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMPLIANCE_DOCUMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="compliance-doc-name">Name</Label>
            <Input
              id="compliance-doc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={errors.name ? true : undefined}
            />
            {errors.name && <p className="text-xs text-red-600">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="compliance-doc-file">Choose file</Label>
            <Input
              id="compliance-doc-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              aria-invalid={errors.file ? true : undefined}
            />
            <p className="text-xs text-muted-foreground">PDF, JPG or PNG</p>
            {errors.file && <p className="text-xs text-red-600">{errors.file}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" disabled={submitting} onClick={submit}>
            {submitting ? 'Uploading…' : 'Upload'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
