import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { 
  Lock, 
  Download, 
  RefreshCw, 
  Upload,
  Plus,
  X,
  ChevronRight,
  FolderOpen,
  FileArchive
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import { RadioGroup, RadioGroupItem } from '../../../../ui/radio-group';
import { Progress } from '../../../../ui/progress';
import { useZipEncryption, FileItem, EncryptionMethod } from '../hooks/useZipEncryption';

// Constants
const DEFAULT_SUBCATEGORIES = [
  "Compliance",
  "New Business Welcome Pack",
  "FICA Documents",
  "Application Forms",
  "Policy Schedule",
  "Other"
];

// --- Sub-components ---

interface ZipUploadSectionProps {
  onFilesAdded: (files: FileItem[]) => void;
  processing: boolean;
}

function ZipUploadSection({ onFilesAdded, processing }: ZipUploadSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadSubcategory, setUploadSubcategory] = useState<string>(DEFAULT_SUBCATEGORIES[0]);
  const [customSubcategory, setCustomSubcategory] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      let finalSubcategory = uploadSubcategory;
      
      if (uploadSubcategory === 'Other') {
        if (!customSubcategory.trim()) {
          toast.error('Please enter a name for the custom folder');
          return;
        }
        finalSubcategory = customSubcategory.trim();
      }

      const newFiles: FileItem[] = Array.from(e.target.files).map(f => ({
        id: `upload-${Date.now()}-${f.name}`,
        name: f.name,
        file: f,
        subcategory: finalSubcategory,
        size: f.size
      }));

      onFilesAdded(newFiles);
      toast.success(`${newFiles.length} file(s) added to "${finalSubcategory}"`);
      
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-dashed bg-muted/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Upload className="h-4 w-4" /> Upload Documents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs font-medium">Destination Folder (Inside Zip)</Label>
            <div className="flex gap-2">
              <div className="flex-1">
                <Select value={uploadSubcategory} onValueChange={setUploadSubcategory}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select folder..." />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_SUBCATEGORIES.map(sub => (
                      <SelectItem key={sub} value={sub}>{sub}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {uploadSubcategory === 'Other' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <Label className="text-xs font-medium">Custom Folder Name</Label>
              <Input 
                placeholder="e.g., Client ID Documents" 
                value={customSubcategory}
                onChange={(e) => setCustomSubcategory(e.target.value)}
                className="h-9"
              />
            </div>
          )}

          <div className="pt-2">
             <Button 
              className="w-full"
              onClick={() => {
                if (uploadSubcategory === 'Other' && !customSubcategory.trim()) {
                  toast.error('Please enter a custom folder name first');
                  return;
                }
                fileInputRef.current?.click();
              }}
              disabled={processing}
            >
              <Plus className="h-4 w-4 mr-2" /> Select Files to Add
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              onChange={handleFileUpload}
              multiple
            />
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Files will be added to the <strong>{uploadSubcategory === 'Other' ? (customSubcategory || 'Custom') : uploadSubcategory}</strong> folder.
          </p>
        </CardContent>
      </Card>

      <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm space-y-2 border border-blue-100">
        <p className="font-semibold flex items-center gap-2">
          <FolderOpen className="h-4 w-4" /> How it works
        </p>
        <ul className="list-disc pl-4 space-y-1 text-xs">
          <li>Select a folder category (or create a custom one).</li>
          <li>Upload files for that category.</li>
          <li>Repeat for different categories if needed.</li>
          <li>All files will be zipped together into a single encrypted archive.</li>
        </ul>
      </div>
    </div>
  );
}

interface ZipFileListProps {
  files: FileItem[];
  processing: boolean;
  onRemove: (id: string) => void;
  onClear: () => void;
}

function ZipFileList({ files, processing, onRemove, onClear }: ZipFileListProps) {
  // Group files by subcategory
  const groupedFiles = files.reduce((acc, file) => {
    const sub = file.subcategory || 'General';
    if (!acc[sub]) acc[sub] = [];
    acc[sub].push(file);
    return acc;
  }, {} as Record<string, FileItem[]>);

  return (
    <div className="bg-muted/50 rounded-lg p-4 border min-h-[300px] flex flex-col">
      <h3 className="font-medium text-sm mb-3 flex items-center justify-between">
        Selected Files ({files.length})
        {files.length > 0 && !processing && (
          <Button variant="ghost" size="sm" className="h-6 text-xs text-destructive hover:text-destructive" onClick={onClear}>
            Clear All
          </Button>
        )}
      </h3>
      
      <div className="flex-1 overflow-y-auto space-y-4 max-h-[400px]">
        {Object.entries(groupedFiles).length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-muted-foreground opacity-50">
            <FileArchive className="h-12 w-12 mb-2" />
            <p className="text-sm">No files added yet</p>
          </div>
        ) : (
          Object.entries(groupedFiles).map(([category, fileList]) => (
            <div key={category} className="space-y-1">
              <div className="flex items-center gap-2 px-2">
                 <FolderOpen className="h-3 w-3 text-muted-foreground" />
                 <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {category}
                </span>
              </div>
              
              {fileList.map(file => (
                <div key={file.id} className="group flex items-center justify-between p-2 bg-background border rounded-md text-sm">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <span className="truncate">{file.name}</span>
                    <span className="text-[10px] text-muted-foreground ml-2">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  {!processing && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => onRemove(file.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

interface ZipSettingsSectionProps {
  zipFilename: string;
  setZipFilename: (s: string) => void;
  encryptionMethod: EncryptionMethod;
  setEncryptionMethod: (m: EncryptionMethod) => void;
  password: string;
  setPassword: (s: string) => void;
  processing: boolean;
  progress: number;
  currentAction: string;
  zipUrl: string | null;
  onGenerate: () => void;
  onReset: () => void;
  fileCount: number;
}

function ZipSettingsSection({
  zipFilename,
  setZipFilename,
  encryptionMethod,
  setEncryptionMethod,
  password,
  setPassword,
  processing,
  progress,
  currentAction,
  zipUrl,
  onGenerate,
  onReset,
  fileCount
}: ZipSettingsSectionProps) {
  
  if (zipUrl) {
    return (
      <div className="p-4 bg-green-50 border border-green-100 rounded-md space-y-3 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2 text-green-800 font-medium text-sm">
          <RefreshCw className="h-4 w-4" /> Ready for download
        </div>
        <a href={zipUrl} download={`${zipFilename || 'secure-archive'}.zip`} className="block">
          <Button className="w-full bg-green-600 hover:bg-green-700">
            <Download className="h-4 w-4 mr-2" /> Download Zip
          </Button>
        </a>
        <Button variant="outline" size="sm" className="w-full" onClick={onReset}>
          Create Another
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
       {/* Settings Section */}
       <div className="space-y-4 pt-2 border-t">
          <div className="space-y-2">
            <Label htmlFor="zip-name">Archive Name</Label>
            <div className="flex items-center gap-2">
              <Input 
                id="zip-name" 
                placeholder="e.g. Client_Documents" 
                value={zipFilename}
                onChange={(e) => setZipFilename(e.target.value)}
                disabled={processing}
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">.zip</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Encryption Method</Label>
            <RadioGroup 
              value={encryptionMethod} 
              onValueChange={(val: EncryptionMethod) => setEncryptionMethod(val)}
              className="grid grid-cols-1 gap-2"
              disabled={processing}
            >
              <div className={`flex items-start space-x-3 space-y-0 rounded-md border p-3 cursor-pointer hover:bg-muted/50 ${encryptionMethod === 'individual' ? 'border-primary bg-primary/5' : ''}`}>
                <RadioGroupItem value="individual" id="method-individual" className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor="method-individual" className="font-medium cursor-pointer">Individual Files</Label>
                  <p className="text-xs text-muted-foreground">
                    Files are encrypted individually inside the zip. You can see the file list without a password, but need the password to open each file.
                  </p>
                </div>
              </div>
              <div className={`flex items-start space-x-3 space-y-0 rounded-md border p-3 cursor-pointer hover:bg-muted/50 ${encryptionMethod === 'folder' ? 'border-primary bg-primary/5' : ''}`}>
                <RadioGroupItem value="folder" id="method-folder" className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor="method-folder" className="font-medium cursor-pointer">Entire Folder (Recommended)</Label>
                  <p className="text-xs text-muted-foreground">
                    Wraps everything in a secure envelope. You enter the password once to unlock the package, then all files inside are accessible.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>
       </div>

       <div className="space-y-2">
        <Label htmlFor="zip-pass">Encryption Password</Label>
        <Input 
          id="zip-pass" 
          type="password" 
          placeholder="Enter password..."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={processing}
        />
      </div>

      {processing && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{currentAction || 'Processing...'}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      )}

      <Button 
        className="w-full" 
        disabled={fileCount === 0 || password.length < 4 || !zipFilename.trim() || processing}
        onClick={onGenerate}
      >
        {processing ? (
          <div className="contents">
            <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Processing...
          </div>
        ) : (
          <div className="contents">
            <Lock className="h-4 w-4 mr-2" /> Generate Encrypted Zip
          </div>
        )}
      </Button>
    </div>
  );
}

// --- Main Component ---

export function ZipEncryptTool() {
  const [isOpen, setIsOpen] = useState(false);
  
  // Local State for input management
  const [uploadedFiles, setUploadedFiles] = useState<FileItem[]>([]);
  const [password, setPassword] = useState('');
  const [zipFilename, setZipFilename] = useState('secure-archive');
  const [encryptionMethod, setEncryptionMethod] = useState<EncryptionMethod>('individual');

  // Custom Hook
  const { 
    processing, 
    progress, 
    currentAction, 
    zipUrl, 
    generateZip, 
    reset 
  } = useZipEncryption();

  const handleFilesAdded = (files: FileItem[]) => {
    setUploadedFiles(prev => [...prev, ...files]);
  };

  const removeFile = (id: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  };

  const clearAll = () => {
    setUploadedFiles([]);
    reset();
  };

  const handleReset = () => {
    clearAll();
    setPassword('');
    setZipFilename('secure-archive');
    setEncryptionMethod('individual');
    reset();
  };

  const handleGenerate = () => {
    generateZip(uploadedFiles, password, zipFilename, encryptionMethod);
  };

  return (
    <div className="contents">
      <Card className="hover:shadow-md transition-shadow cursor-pointer border-dashed border-2 hover:border-primary/50" onClick={() => setIsOpen(true)}>
        <CardHeader>
          <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Zip & Encrypt</CardTitle>
          <CardDescription>
            Securely package documents into a password-protected zip file.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Upload files from your device, organize them into folders, and encrypt them.
          </p>
        </CardContent>
        <CardFooter>
          <Button variant="ghost" className="w-full justify-start pl-0 text-primary group-hover:pl-2 transition-all">
            Open Tool <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        </CardFooter>
      </Card>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Zip & Encrypt Tool
            </DialogTitle>
            <DialogDescription>
              Create a secure archive from your documents. Files are processed locally on your device.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 py-4">
            {/* Left Column: Upload & Instructions */}
            <ZipUploadSection 
              onFilesAdded={handleFilesAdded} 
              processing={processing} 
            />

            {/* Right Column: List & Settings */}
            <div className="space-y-6">
              <ZipFileList 
                files={uploadedFiles} 
                processing={processing} 
                onRemove={removeFile}
                onClear={clearAll}
              />

              <ZipSettingsSection 
                zipFilename={zipFilename}
                setZipFilename={setZipFilename}
                encryptionMethod={encryptionMethod}
                setEncryptionMethod={setEncryptionMethod}
                password={password}
                setPassword={setPassword}
                processing={processing}
                progress={progress}
                currentAction={currentAction}
                zipUrl={zipUrl}
                onGenerate={handleGenerate}
                onReset={handleReset}
                fileCount={uploadedFiles.length}
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}