/**
 * DownloadCodebaseTab
 *
 * Provides a UI for downloading the codebase / design system assets.
 * Displayed within the Design System page's "Download" tab.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Button } from '../../ui/button';
import { Badge } from '../../ui/badge';
import { Download, Package, FileCode2, Palette, FolderArchive, Check, Copy } from 'lucide-react';

// ============================================================================
// CONSTANTS
// ============================================================================

const DOWNLOAD_SECTIONS = [
  {
    id: 'design-tokens',
    title: 'Design Tokens',
    description: 'CSS custom properties, colour palette, spacing scale, and typography definitions.',
    icon: 'palette',
    format: 'CSS / JSON',
    version: '1.0.0',
  },
  {
    id: 'ui-components',
    title: 'UI Components',
    description: 'Reusable React component library built with Radix UI primitives and Tailwind CSS.',
    icon: 'package',
    format: 'TSX',
    version: '1.0.0',
  },
  {
    id: 'page-templates',
    title: 'Page Templates',
    description: 'Pre-built page layouts for common admin panel views (lists, detail, forms, dashboards).',
    icon: 'filecode',
    format: 'TSX',
    version: '1.0.0',
  },
  {
    id: 'full-codebase',
    title: 'Full Codebase',
    description: 'Complete Navigate Wealth admin panel source code including all modules and configuration.',
    icon: 'folder',
    format: 'ZIP',
    version: '1.0.0',
  },
] as const;

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  palette: Palette,
  package: Package,
  filecode: FileCode2,
  folder: FolderArchive,
};

// ============================================================================
// COMPONENT
// ============================================================================

export const DownloadCodebaseTab: React.FC = () => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyInstall = (id: string) => {
    const command = `npx navigate-wealth-cli init --template ${id}`;
    navigator.clipboard.writeText(command).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900">Download Resources</h3>
        <p className="text-sm text-gray-500 mt-1">
          Download design system assets, component libraries, and project templates for local development.
        </p>
      </div>

      {/* Download Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {DOWNLOAD_SECTIONS.map((section) => {
          const IconComponent = ICON_MAP[section.icon] || Package;
          return (
            <Card key={section.id} className="border border-gray-200 hover:border-gray-300 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-50 rounded-lg">
                      <IconComponent className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <CardTitle className="text-sm font-semibold text-gray-900">
                        {section.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono">
                          v{section.version}
                        </Badge>
                        <span className="text-[10px] text-gray-400">{section.format}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-3">
                <CardDescription className="text-xs text-gray-500 leading-relaxed">
                  {section.description}
                </CardDescription>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 gap-1.5"
                    onClick={() => handleCopyInstall(section.id)}
                  >
                    {copiedId === section.id ? (
                      <Check className="h-3 w-3 text-green-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copiedId === section.id ? 'Copied' : 'Copy CLI'}
                  </Button>
                  <Button
                    size="sm"
                    className="text-xs h-8 gap-1.5 bg-gray-900 hover:bg-gray-800 text-white"
                    disabled
                  >
                    <Download className="h-3 w-3" />
                    Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info Note */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs text-amber-800">
          <strong className="font-semibold">Note:</strong> Direct downloads are not yet available in this environment.
          Use the CLI commands or contact the development team for access to the full design system package.
        </p>
      </div>
    </div>
  );
};

export default DownloadCodebaseTab;
