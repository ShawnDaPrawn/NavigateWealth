/**
 * Portfolio Summary — Documents Card
 * Displays recent documents and upload/download actions.
 * Guidelines §7 (presentation only), §8.3 (consistent patterns).
 */

import React from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Separator } from '../../../ui/separator';
import {
  FileText,
  Download,
  Upload,
  CheckCircle,
  AlertTriangle,
  FolderOpen,
} from 'lucide-react';
import type { PortfolioDocument } from '../api';
import { formatDate } from '../utils';

interface DocumentsCardProps {
  documents: PortfolioDocument[];
  onUploadClick: () => void;
}

export function DocumentsCard({ documents, onUploadClick }: DocumentsCardProps) {
  return (
    <Card className="bg-white border-gray-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5 text-purple-600" />
            <CardTitle className="text-black">My Documents</CardTitle>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-purple-600 text-purple-600 hover:bg-purple-50"
            asChild
          >
            <Link to="/transactions-documents">Go to Full Vault</Link>
          </Button>
        </div>
        <CardDescription>Recent uploads and important documents</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {documents.length === 0 && (
            <div className="flex flex-col items-center py-6 text-center">
              <FolderOpen className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-600">No documents yet</p>
              <p className="text-xs text-gray-500 mt-1">
                Upload your first document to get started.
              </p>
            </div>
          )}
          {documents.slice(0, 4).map((document) => (
            <div key={document.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="flex-shrink-0">
                  {document.uploaded ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-black truncate">{document.documentType}</p>
                  <p className="text-xs text-gray-500">{document.category}</p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500">
                  {document.uploaded ? formatDate(document.uploadDate) : 'Missing'}
                </span>
                {document.uploaded ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    asChild
                  >
                    <Link to="/transactions-documents">
                      <Download className="h-4 w-4" />
                    </Link>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs px-2 py-1 h-auto"
                    onClick={onUploadClick}
                  >
                    Upload
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
        <Separator className="my-4" />
        <div className="flex space-x-2">
          <Button size="sm" variant="outline" className="flex-1" onClick={onUploadClick}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
          <Button size="sm" variant="outline" className="flex-1" asChild>
            <Link to="/transactions-documents">
              <Download className="mr-2 h-4 w-4" />
              View All Documents
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
