import React, { useState, useRef } from 'react';

import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Unlock, Download, RefreshCw, FileText, ShieldAlert, X } from 'lucide-react';
import { toast } from 'sonner';

import { usePdfDecryption } from '../hooks/usePdfDecryption';

/** The PDF Decryptor's page body (Resources › Tools › PDF Decryptor). */
export function PdfDecryptTool() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { processing, decryptedUrl, decryptPdf, reset } = usePdfDecryption();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== 'application/pdf') {
        toast.error('Please upload a valid PDF file');
        return;
      }
      setFile(selectedFile);
      reset(); // Reset previous result if any
    }
  };

  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    reset();
  };

  const handleDecrypt = () => {
    if (file && password) {
      decryptPdf(file, password);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPassword('');
    reset();
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-xl space-y-6 rounded-xl border border-nw-line bg-white p-6">
      {/* Success State */}
      {decryptedUrl ? (
        <div className="bg-green-50 border border-green-100 rounded-lg p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="mx-auto h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
            <Unlock className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h3 className="font-medium text-green-900">PDF unlocked successfully</h3>
            <p className="text-sm text-green-700 mt-1">Your document is ready to download.</p>
          </div>

          <a
            href={decryptedUrl}
            download={`unlocked_${file?.name || 'document.pdf'}`}
            className="block w-full"
          >
            <Button className="w-full bg-green-600 hover:bg-green-700">
              <Download className="h-4 w-4 mr-2" /> Download unlocked PDF
            </Button>
          </a>

          <Button variant="outline" size="sm" onClick={handleReset} className="w-full">
            Decrypt another file
          </Button>
        </div>
      ) : (
        /* Input State */
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Upload encrypted PDF</Label>
            {!file ? (
              <div
                className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Click to upload PDF</p>
                <p className="text-xs text-muted-foreground mt-1">Max file size: 50MB</p>
              </div>
            ) : (
              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30 overflow-hidden">
                <div className="flex items-center gap-3 overflow-hidden min-w-0">
                  <div className="h-8 w-8 bg-red-100 rounded flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 text-red-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRemoveFile}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0 ml-2"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept=".pdf"
              onChange={handleFileChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pdf-pass">Current password</Label>
            <Input
              id="pdf-pass"
              type="password"
              placeholder="Enter password (leave blank if not required to open)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={!file}
            />
            <p className="text-[10px] text-muted-foreground">
              If the file opens without a password but has printing or editing restrictions, leave
              this blank.
            </p>
          </div>

          <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-md border border-amber-100 flex gap-2">
            <ShieldAlert className="h-4 w-4 flex-shrink-0" />
            <p>This tool removes all password protection and restrictions.</p>
          </div>

          <Button className="w-full" onClick={handleDecrypt} disabled={!file || processing}>
            {processing ? (
              <div className="contents">
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Decrypting...
              </div>
            ) : (
              <div className="contents">
                <Unlock className="h-4 w-4 mr-2" /> Decrypt PDF
              </div>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
