import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { 
  Unlock, 
  Download, 
  RefreshCw, 
  Upload,
  FileText,
  ChevronRight,
  ShieldAlert,
  X
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { usePdfDecryption } from '../hooks/usePdfDecryption';

export function PdfDecryptTool() {
  const [isOpen, setIsOpen] = useState(false);
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
    <div className="contents">
      <Card className="hover:shadow-md transition-shadow cursor-pointer border-dashed border-2 hover:border-red-500/50" onClick={() => setIsOpen(true)}>
        <CardHeader>
          <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center mb-4">
            <Unlock className="h-6 w-6 text-red-600" />
          </div>
          <CardTitle>PDF Decryptor</CardTitle>
          <CardDescription>
            Permanently remove password protection from standard PDF documents.
            <span className="block mt-1 text-xs text-muted-foreground bg-muted/50 p-1 rounded">
              Note: Does not support AES-256 encryption (common in some modern PDF viewers).
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Unlock PDF files so they can be viewed, edited, or printed without entering a password every time.
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="ghost" className="w-full justify-start pl-0 text-red-600 group-hover:pl-2 transition-all">
            Open Tool <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={isOpen} onOpenChange={(open) => {
        setIsOpen(open);
        if (!open) handleReset();
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Unlock className="h-5 w-5 text-red-600" />
              PDF Decryptor
            </DialogTitle>
            <DialogDescription>
              Remove encryption from your PDF permanently. The file is processed locally in your browser.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Success State */}
            {decryptedUrl ? (
              <div className="bg-green-50 border border-green-100 rounded-lg p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="mx-auto h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <Unlock className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium text-green-900">PDF Unlocked Successfully!</h3>
                  <p className="text-sm text-green-700 mt-1">Your document is ready to download.</p>
                </div>
                
                <a 
                  href={decryptedUrl} 
                  download={`unlocked_${file?.name || 'document.pdf'}`} 
                  className="block w-full"
                >
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    <Download className="h-4 w-4 mr-2" /> Download Unlocked PDF
                  </Button>
                </a>
                
                <Button variant="outline" size="sm" onClick={handleReset} className="w-full">
                  Decrypt Another File
                </Button>
              </div>
            ) : (
              /* Input State */
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Upload Encrypted PDF</Label>
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
                    <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                      <div className="flex items-center gap-3 overflow-hidden">
                        <div className="h-8 w-8 bg-red-100 rounded flex items-center justify-center flex-shrink-0">
                          <FileText className="h-4 w-4 text-red-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" onClick={handleRemoveFile} className="h-8 w-8 text-muted-foreground hover:text-destructive">
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
                  <Label htmlFor="pdf-pass">Current Password</Label>
                  <Input 
                    id="pdf-pass" 
                    type="password" 
                    placeholder="Enter password (leave blank if not required to open)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={!file}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    If the file opens without a password but has printing/editing restrictions, leave this blank.
                  </p>
                </div>

                <div className="bg-amber-50 text-amber-800 text-xs p-3 rounded-md border border-amber-100 flex gap-2">
                  <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                  <p>
                    This tool removes all password protection and restrictions.
                  </p>
                </div>

                <Button 
                  className="w-full" 
                  onClick={handleDecrypt} 
                  disabled={!file || processing}
                >
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
        </DialogContent>
      </Dialog>
    </div>
  );
}