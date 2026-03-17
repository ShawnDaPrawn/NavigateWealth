import { useState } from 'react';
import { toast } from 'sonner@2.0.3';
import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js';

export interface FileItem {
  id: string;
  name: string;
  file: File;
  subcategory: string;
  size: number;
}

export type EncryptionMethod = 'individual' | 'folder';

interface UseZipEncryptionResult {
  processing: boolean;
  progress: number;
  currentAction: string;
  zipUrl: string | null;
  generateZip: (
    files: FileItem[], 
    password: string, 
    filename: string, 
    method: EncryptionMethod
  ) => Promise<void>;
  reset: () => void;
}

export function useZipEncryption(): UseZipEncryptionResult {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentAction, setCurrentAction] = useState('');
  const [zipUrl, setZipUrl] = useState<string | null>(null);

  const generateZip = async (
    files: FileItem[], 
    password: string, 
    filename: string, 
    method: EncryptionMethod
  ) => {
    if (files.length === 0) {
      toast.error('Please add at least one document');
      return;
    }
    if (!password || password.length < 4) {
      toast.error('Please enter a password (min 4 characters)');
      return;
    }
    if (!filename.trim()) {
      toast.error('Please enter a filename for the zip');
      return;
    }

    setProcessing(true);
    setZipUrl(null);
    setProgress(0);
    setCurrentAction('Initializing...');

    try {
      if (method === 'individual') {
        await generateIndividualEncryptionZip(files, password);
      } else {
        await generateFolderEncryptionZip(files, password, filename);
      }
    } catch (error: unknown) {
      console.error('Zip generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate zip');
    } finally {
      setProcessing(false);
    }
  };

  const generateIndividualEncryptionZip = async (files: FileItem[], password: string) => {
    const blobWriter = new BlobWriter("application/zip");
    const zipWriter = new ZipWriter(blobWriter, { bufferedWrite: true, useWebWorkers: false });
    const totalFiles = files.length;

    try {
      for (let i = 0; i < totalFiles; i++) {
        const item = files[i];
        setCurrentAction(`Compressing ${item.name}...`);
        
        const folder = item.subcategory.trim();
        const zipFilename = folder ? `${folder}/${item.name}` : item.name;

        await zipWriter.add(zipFilename, new BlobReader(item.file), {
          password: password,
          level: 5,
          zipCrypto: true
        });

        setProgress(Math.round(((i + 1) / totalFiles) * 90));
      }

      setCurrentAction('Finalizing archive...');
      await zipWriter.close();
      const blob = await blobWriter.getData();
      const url = URL.createObjectURL(blob);
      setZipUrl(url);
      setProgress(100);
      setCurrentAction('Done!');
      toast.success('Encrypted Zip generated successfully');
    } catch (error) {
      throw error;
    }
  };

  const generateFolderEncryptionZip = async (files: FileItem[], password: string, zipFilename: string) => {
    try {
      // Step 1: Create Inner Unencrypted Zip
      setCurrentAction('Creating internal archive structure...');
      const innerBlobWriter = new BlobWriter("application/zip");
      const innerZipWriter = new ZipWriter(innerBlobWriter, { bufferedWrite: true, useWebWorkers: false });
      
      const totalFiles = files.length;
      
      for (let i = 0; i < totalFiles; i++) {
        const item = files[i];
        const folder = item.subcategory.trim();
        const filename = folder ? `${folder}/${item.name}` : item.name;

        await innerZipWriter.add(filename, new BlobReader(item.file), {
          level: 0, // No compression for inner zip to speed up, outer zip will compress
        });
        
        setProgress(Math.round(((i + 1) / totalFiles) * 40));
      }
      
      await innerZipWriter.close();
      const innerBlob = await innerBlobWriter.getData();
      
      // Step 2: Create Outer Encrypted Zip containing the Inner Zip
      setCurrentAction('Encrypting master archive...');
      const outerBlobWriter = new BlobWriter("application/zip");
      const outerZipWriter = new ZipWriter(outerBlobWriter, { bufferedWrite: true, useWebWorkers: false });
      
      const innerFilename = `${zipFilename}_content.zip`;

      await outerZipWriter.add(innerFilename, new BlobReader(innerBlob), {
        password: password,
        level: 5,
        zipCrypto: true
      });
      
      setProgress(90);
      setCurrentAction('Finalizing secure package...');
      
      await outerZipWriter.close();
      const outerBlob = await outerBlobWriter.getData();
      const url = URL.createObjectURL(outerBlob);
      
      setZipUrl(url);
      setProgress(100);
      setCurrentAction('Done!');
      toast.success('Secure Folder Archive generated successfully');
    } catch (error) {
      throw error;
    }
  };

  const reset = () => {
    if (zipUrl) {
      URL.revokeObjectURL(zipUrl);
    }
    setZipUrl(null);
    setProgress(0);
    setCurrentAction('');
    setProcessing(false);
  };

  return {
    processing,
    progress,
    currentAction,
    zipUrl,
    generateZip,
    reset
  };
}