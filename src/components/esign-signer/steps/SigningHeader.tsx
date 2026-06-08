import { FileText, Download } from 'lucide-react';
import { Button } from '../../ui/button';
import { Progress } from '../../ui/progress';

interface SigningHeaderProps {
  envelopeTitle: string;
  signerName: string;
  signerEmail: string;
  isReading: boolean;
  completedCount: number;
  requiredCount: number;
  progress: number;
  onDownloadOriginal: () => void;
}

export function SigningHeader({
  envelopeTitle,
  signerName,
  signerEmail,
  isReading,
  completedCount,
  requiredCount,
  progress,
  onDownloadOriginal,
}: SigningHeaderProps) {
  return (
    <header className="bg-white border-b h-14 md:h-16 flex items-center justify-between px-3 md:px-6 flex-shrink-0 sticky top-0 z-50 shadow-sm">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div className="h-8 w-8 hidden md:flex rounded-lg bg-indigo-600 text-white items-center justify-center shadow-sm flex-shrink-0">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <h1 className="text-sm md:text-base font-semibold truncate max-w-[180px] md:max-w-md text-gray-900">
            {envelopeTitle}
          </h1>
          <p className="text-[11px] text-gray-500 hidden md:block truncate">
            {signerName} • {signerEmail}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDownloadOriginal}
          className="text-gray-600 hover:text-indigo-700 hover:bg-indigo-50 h-9 px-2 md:px-3"
        >
          <Download className="h-4 w-4 md:mr-1.5" />
          <span className="hidden md:inline">Download to read</span>
        </Button>

        {!isReading && (
          <div className="hidden md:flex items-center ml-1">
            <div className="text-right mr-2">
              <p className="text-xs font-medium text-gray-900">
                {completedCount}/{requiredCount} done
              </p>
              <Progress value={progress} className="h-1.5 w-24 mt-1" />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
