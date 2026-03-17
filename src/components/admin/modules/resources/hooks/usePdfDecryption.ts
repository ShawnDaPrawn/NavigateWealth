import { useState } from 'react';
import { toast } from 'sonner@2.0.3';
import { PDFDocument } from 'pdf-lib';

interface UsePdfDecryptionResult {
  processing: boolean;
  decryptedUrl: string | null;
  decryptPdf: (file: File, password: string) => Promise<void>;
  reset: () => void;
}

export function usePdfDecryption(): UsePdfDecryptionResult {
  const [processing, setProcessing] = useState(false);
  const [decryptedUrl, setDecryptedUrl] = useState<string | null>(null);

  const decryptPdf = async (file: File, password: string) => {
    if (!file) {
      toast.error('Please upload a PDF file');
      return;
    }

    setProcessing(true);
    setDecryptedUrl(null);

    // Keep references to original console methods to restore them later
    const originalWarn = console.warn;
    const originalError = console.error;

    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // pdf-lib can be very noisy with console.warn/error when it encounters 
      // encrypted files it doesn't support (AES-256) or corrupt xref tables.
      // We temporarily suppress these logs to keep the console clean, 
      // as we handle the failure gracefully in the catch block.
      console.warn = () => {};
      console.error = () => {};

      // Load the PDF with the provided password.
      // If the password is blank, we pass an empty string.
      const pdfDoc = await PDFDocument.load(arrayBuffer, { password: password || '' });
      
      // Restore console methods before saving, in case save() has useful warnings
      console.warn = originalWarn;
      console.error = originalError;

      // Save the PDF without encryption.
      const decryptedBytes = await pdfDoc.save();
      
      const blob = new Blob([decryptedBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      
      setDecryptedUrl(url);
      toast.success('PDF decrypted successfully');
    } catch (error: unknown) {
      // Restore console methods immediately if they haven't been restored yet
      console.warn = originalWarn;
      console.error = originalError;

      const errorMessage = error instanceof Error ? error.message : '';

      // Log the actual error for debugging (controlled)
      console.warn('PDF Decryption failed (Handled):', errorMessage);
      
      // Handle specific pdf-lib error messages
      if (errorMessage.includes('Input document to `PDFDocument.load` is encrypted')) {
        toast.error('Decryption Failed: Unsupported Encryption', {
          description: 'This PDF uses an advanced encryption standard (likely AES-256) that cannot be decrypted in the browser. Please use Adobe Acrobat or a server-side tool.',
          duration: 8000
        });
      } else if (errorMessage.toLowerCase().includes('password')) {
        toast.error('Incorrect password. Please try again.');
      } else if (errorMessage.includes('Invalid object ref') || errorMessage.includes('Trying to parse invalid object')) {
        toast.error('Decryption Failed: File Structure Issue', {
           description: 'The PDF structure appears to be corrupt or uses a compression method incompatible with the decryptor.',
           duration: 6000
        });
      } else {
        toast.error('Failed to decrypt PDF', {
          description: 'The file might be corrupt or use an unsupported format.',
        });
      }
    } finally {
      // Safety net: ensure console is restored even if something catastrophic happens
      if (console.warn !== originalWarn) console.warn = originalWarn;
      if (console.error !== originalError) console.error = originalError;
      
      setProcessing(false);
    }
  };

  const reset = () => {
    if (decryptedUrl) {
      URL.revokeObjectURL(decryptedUrl);
    }
    setDecryptedUrl(null);
    setProcessing(false);
  };

  return {
    processing,
    decryptedUrl,
    decryptPdf,
    reset
  };
}