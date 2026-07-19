/**
 * Logo upload / replace card with a signed-URL preview. The logo brands the
 * supplier's generated invoices.
 */

import { useRef } from 'react';
import { ImageIcon, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../../ui/card';
import { LOGO_ACCEPT, MAX_FILE_BYTES } from '../constants';
import { useSupplierLogoUrl, useUploadLogo } from '../hooks/useSuppliers';
import type { Supplier } from '../types';

export function LogoUploadCard({ supplier }: { supplier: Supplier }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadLogo();
  const { data: logoUrl } = useSupplierLogoUrl(supplier.id, Boolean(supplier.logo));

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error('Logo exceeds the 10MB limit');
      return;
    }
    upload.mutate({ supplierId: supplier.id, file });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Logo</CardTitle>
        <CardDescription>
          Used on generated invoices to match the supplier's branding. JPEG or PNG.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-4">
        <div className="w-24 h-24 rounded-lg border bg-muted/30 flex items-center justify-center overflow-hidden shrink-0">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={`${supplier.name} logo`}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
          )}
        </div>
        <div className="space-y-2">
          <input
            ref={inputRef}
            type="file"
            accept={LOGO_ACCEPT}
            className="hidden"
            onChange={(e) => {
              handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={upload.isPending}
          >
            <Upload className="h-4 w-4 mr-2" />
            {upload.isPending ? 'Uploading…' : supplier.logo ? 'Replace Logo' : 'Upload Logo'}
          </Button>
          {supplier.logo ? (
            <p className="text-xs text-muted-foreground">{supplier.logo.fileName}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
