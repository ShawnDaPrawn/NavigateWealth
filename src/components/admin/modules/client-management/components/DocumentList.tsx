import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Button } from '../../../../ui/button';
import { Badge } from '../../../../ui/badge';
import {
  FileText,
  Download,
  Trash2,
  Link as LinkIcon,
  ExternalLink,
  Plus,
  Folder,
  RefreshCw,
  Heart,
  Shield,
  TrendingUp,
  Activity,
  Briefcase,
  Home,
  ChevronDown,
  ChevronRight,
  Files,
  Mail,
} from 'lucide-react';
import type { DocumentItem, GroupedDocItem } from './documentsUtils';

function getCategoryIcon(category: string) {
  switch (category) {
    case 'Life':
      return <Heart className="h-4 w-4" />;

    case 'Short-Term':
      return <Shield className="h-4 w-4" />;

    case 'Investment':
      return <TrendingUp className="h-4 w-4" />;

    case 'Medical Aid':
      return <Activity className="h-4 w-4" />;

    case 'Retirement':
      return <Briefcase className="h-4 w-4" />;

    case 'Estate':
      return <Home className="h-4 w-4" />;

    default:
      return <FileText className="h-4 w-4" />;
  }
}

function getCategoryColor(category: string) {
  switch (category) {
    case 'Life':
      return 'bg-red-50 text-red-700 border-red-200';

    case 'Short-Term':
      return 'bg-blue-50 text-blue-700 border-blue-200';

    case 'Investment':
      return 'bg-green-50 text-green-700 border-green-200';

    case 'Medical Aid':
      return 'bg-purple-50 text-purple-700 border-purple-200';

    case 'Retirement':
      return 'bg-orange-50 text-orange-700 border-orange-200';

    case 'Estate':
      return 'bg-amber-50 text-amber-700 border-amber-200';

    default:
      return 'bg-gray-50 text-gray-700 border-gray-200';
  }
}

function formatDate(dateString: string) {
  const date = new Date(dateString);

  return date.toLocaleDateString('en-GB', {
    day: 'numeric',

    month: 'short',

    year: 'numeric',
  });
}

function formatFileSize(bytes?: number) {
  if (!bytes) return '';

  const mb = bytes / (1024 * 1024);

  return `${mb.toFixed(2)} MB`;
}

interface DocumentListProps {
  loading: boolean;
  documents: DocumentItem[];
  filteredDocuments: DocumentItem[];
  groupedItems: GroupedDocItem[];
  expandedPacks: Set<string>;
  onTogglePack: (packId: string) => void;
  onDownload: (doc: DocumentItem) => void;
  onDeleteDocument: (doc: DocumentItem) => void;
  onDeletePack: (packId: string, count: number) => void;
  onResendPack: (pack: { id: string; documents: DocumentItem[] }) => void;
  onUploadClick: () => void;
}

/** The pack-grouped document/link list (with per-row + per-pack actions) that
 *  forms the body of DocumentsTab. */
export function DocumentList({
  loading,
  documents,
  filteredDocuments,
  groupedItems,
  expandedPacks,
  onTogglePack,
  onDownload,
  onDeleteDocument,
  onDeletePack,
  onResendPack,
  onUploadClick,
}: DocumentListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Folder className="h-5 w-5" />
          Client Documents & Links
          {documents.length > 0 && filteredDocuments.length !== documents.length && (
            <span className="text-sm font-normal text-muted-foreground ml-2">
              (Showing {filteredDocuments.length} of {documents.length})
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2" />
            Loading documents...
          </div>
        ) : filteredDocuments.length === 0 ? (
          <div className="text-center py-12">
            <Folder className="h-12 w-12 text-muted-foreground mx-auto mb-3" />

            <p className="text-muted-foreground">
              {documents.length === 0 ? 'No documents yet' : 'No matching documents found'}
            </p>

            <p className="text-sm text-muted-foreground mt-1">
              {documents.length === 0
                ? 'Upload documents or add links to get started'
                : 'Try adjusting your filters or search terms'}
            </p>

            {documents.length === 0 && (
              <Button className="mt-4" onClick={() => onUploadClick()}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Item
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {groupedItems.map((item) => {
              if ('documents' in item) {
                // Render Pack

                const isExpanded = expandedPacks.has(item.id);

                return (
                  <div
                    key={item.id}
                    className="border rounded-lg overflow-hidden transition-all hover:border-gray-300"
                  >
                    {/* Pack Header */}

                    <div
                      className="flex items-center gap-4 p-4 cursor-pointer bg-slate-50/50 hover:bg-slate-50"
                      onClick={() => onTogglePack(item.id)}
                    >
                      <div className="flex-shrink-0">
                        <div className="h-12 w-12 rounded-lg flex items-center justify-center bg-blue-50 text-blue-600">
                          <Files className="h-6 w-6" />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium truncate">{item.title}</h4>

                          <Badge variant="secondary" className="text-xs">
                            {item.documents.length} files
                          </Badge>

                          {item.status === 'new' && (
                            <Badge className="bg-blue-100 text-blue-800">New</Badge>
                          )}
                        </div>

                        <p className="text-sm text-muted-foreground">
                          Document Pack • Uploaded {formatDate(item.date)}
                        </p>

                        <div className="flex items-center gap-2 mt-2">
                          <Badge className={`${getCategoryColor(item.category)} border`}>
                            <span className="flex items-center gap-1">
                              {getCategoryIcon(item.category)}

                              <span className="text-xs">{item.category}</span>
                            </span>
                          </Badge>

                          {item.policyNumber && (
                            <Badge variant="outline" className="text-xs">
                              {item.policyNumber}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 mr-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                          onClick={(e) => {
                            e.stopPropagation();

                            onResendPack({ id: item.id, documents: item.documents });
                          }}
                          title="Resend Pack"
                        >
                          <Mail className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();

                            onDeletePack(item.id, item.documents.length);
                          }}
                          title="Delete Entire Pack"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>

                        <div className="text-muted-foreground">
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Pack Content (Expanded) */}

                    {isExpanded && (
                      <div className="bg-slate-50 border-t p-3 pl-8 space-y-4">
                        {(() => {
                          // Group docs by subcategory

                          const docsBySubcat: Record<string, DocumentItem[]> = {};

                          const looseDocs: DocumentItem[] = [];

                          item.documents.forEach((d) => {
                            if (d.subcategory) {
                              if (!docsBySubcat[d.subcategory]) docsBySubcat[d.subcategory] = [];

                              docsBySubcat[d.subcategory].push(d);
                            } else {
                              looseDocs.push(d);
                            }
                          });

                          const hasSubcats = Object.keys(docsBySubcat).length > 0;

                          const renderDoc = (doc: DocumentItem) => (
                            <div
                              key={doc.id}
                              className="flex items-center justify-between p-3 bg-white rounded border hover:border-blue-200 transition-colors"
                            >
                              <div className="flex items-center gap-3 overflow-hidden">
                                <FileText className="h-4 w-4 text-slate-400 flex-shrink-0" />

                                <div className="min-w-0">
                                  <p className="text-sm font-medium truncate">{doc.title}</p>

                                  <p className="text-xs text-muted-foreground truncate">
                                    {doc.fileName} • {formatFileSize(doc.fileSize)}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();

                                    onDownload(doc);
                                  }}
                                  title="Download"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation();

                                    onDeleteDocument(doc);
                                  }}
                                  title="Delete"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          );

                          return (
                            <div className="contents">
                              {/* Render Subcategories */}

                              {Object.entries(docsBySubcat).map(([subcatName, docs]) => (
                                <div key={subcatName} className="space-y-2">
                                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 pb-1 border-b border-slate-200">
                                    <Folder className="h-4 w-4 text-violet-500" />

                                    {subcatName}
                                  </div>

                                  {docs.map((doc) => renderDoc(doc))}
                                </div>
                              ))}

                              {/* Render Loose Docs (if mixed) */}

                              {looseDocs.length > 0 && (
                                <div className="space-y-2">
                                  {hasSubcats && (
                                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700 pb-1 border-b border-slate-200">
                                      <FileText className="h-4 w-4 text-slate-400" />
                                      Other Documents
                                    </div>
                                  )}

                                  {looseDocs.map((doc) => renderDoc(doc))}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                );
              } else {
                // Render Single Document

                const doc = item;

                return (
                  <div
                    key={doc.id}
                    className="flex items-start gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {/* Icon */}

                    <div className="flex-shrink-0">
                      <div
                        className={`h-12 w-12 rounded-lg flex items-center justify-center ${
                          doc.type === 'link' ? 'bg-purple-50' : 'bg-red-50'
                        }`}
                      >
                        {doc.type === 'link' ? (
                          <LinkIcon className="h-6 w-6 text-purple-600" />
                        ) : (
                          <FileText className="h-6 w-6 text-red-600" />
                        )}
                      </div>
                    </div>

                    {/* Content */}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium truncate">{doc.title}</h4>

                            {doc.sourceSystem === 'record-of-advice' && (
                              <Badge variant="secondary" className="text-xs">
                                RoA
                              </Badge>
                            )}

                            {doc.status === 'new' && (
                              <Badge className="bg-blue-100 text-blue-800">New</Badge>
                            )}
                          </div>

                          {doc.type === 'document' ? (
                            <p className="text-sm text-muted-foreground">
                              {doc.fileName} • {formatFileSize(doc.fileSize)} • Uploaded{' '}
                              {formatDate(doc.uploadDate)}
                            </p>
                          ) : (
                            <div>
                              <p className="text-sm text-blue-600 truncate">{doc.url}</p>

                              {doc.description && (
                                <p className="text-sm text-muted-foreground mt-1">
                                  {doc.description}
                                </p>
                              )}

                              <p className="text-sm text-muted-foreground mt-1">
                                Added {formatDate(doc.uploadDate)}
                              </p>
                            </div>
                          )}

                          <div className="flex items-center gap-2 mt-2">
                            <Badge className={`${getCategoryColor(doc.productCategory)} border`}>
                              <span className="flex items-center gap-1">
                                {getCategoryIcon(doc.productCategory)}

                                <span className="text-xs">{doc.productCategory}</span>
                              </span>
                            </Badge>

                            {doc.policyNumber && (
                              <Badge variant="outline" className="text-xs">
                                {doc.policyNumber}
                              </Badge>
                            )}

                            {doc.roaDocumentStatus && (
                              <Badge variant="outline" className="text-xs">
                                {doc.roaDocumentStatus === 'final' ? 'Final' : 'Draft'}
                              </Badge>
                            )}

                            {doc.sha256 && (
                              <Badge variant="outline" className="text-xs font-mono">
                                SHA {doc.sha256.slice(0, 8)}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Actions */}

                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDownload(doc)}
                            title={doc.type === 'link' ? 'Open Link' : 'Download'}
                          >
                            {doc.type === 'link' ? (
                              <ExternalLink className="h-4 w-4" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              onDeleteDocument(doc);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
