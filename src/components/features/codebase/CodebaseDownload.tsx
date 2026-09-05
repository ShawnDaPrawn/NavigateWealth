/**
 * CodebaseDownload
 *
 * Stub component for codebase download functionality.
 * Currently re-exports the DownloadCodebaseTab as the primary UI.
 */

import React from 'react';
import { DownloadCodebaseTab } from './DownloadCodebaseTab';

export const CodebaseDownload: React.FC = () => {
  return <DownloadCodebaseTab />;
};

export default CodebaseDownload;
