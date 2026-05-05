import React from 'react';
import { Button } from '../../../../../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Badge } from '../../../../../ui/badge';
import { RoADraft } from '../DraftRoAInterface';
import { Plus, Clock, FileText, User, Calendar, Lock, Trash2 } from 'lucide-react';

interface RoAStepStartProps {
  onCreateNew: () => void;
  onResume: (draft: RoADraft) => void;
  onResumeFinal?: (draft: RoADraft) => void;
  /** Permanently deletes an unlocked draft (server-supported). */
  onDiscardDraft?: (draft: RoADraft) => void | Promise<void>;
  discardingDraftId?: string | null;
  existingDrafts?: RoADraft[];
  finalisedDrafts?: RoADraft[];
  isLoadingDrafts?: boolean;
}

// Empty array is correct initial state when no drafts exist yet.
export function RoAStepStart({
  onCreateNew,
  onResume,
  onResumeFinal,
  onDiscardDraft,
  discardingDraftId = null,
  existingDrafts = [],
  finalisedDrafts = [],
  isLoadingDrafts = false,
}: RoAStepStartProps) {

  const getClientName = (draft: RoADraft): string => {
    if (draft.clientData) {
      return `${draft.clientData.firstName} ${draft.clientData.lastName}`;
    }
    if (draft.clientSnapshot?.displayName) {
      return draft.clientSnapshot.displayName;
    }
    return 'Client TBD';
  };

  const getCompletionStatus = (draft: RoADraft): { completed: number; total: number } => {
    const total = draft.selectedModules.length;
    const completed = draft.selectedModules.filter(moduleId => 
      draft.moduleData[moduleId] && Object.keys(draft.moduleData[moduleId]).length > 0
    ).length;
    return { completed, total };
  };

  const formatLastUpdated = (date: Date | string): string => {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return '—';
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    if (diffInDays < 7) return `${diffInDays} days ago`;
    return d.toLocaleDateString();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">Record of Advice</h2>
        <p className="text-muted-foreground">
          Create compliant Records of Advice using our guided workflow system
        </p>
      </div>

      {/* Create New Button */}
      <Card className="border-2 border-dashed border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Plus className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-semibold mb-2">Start New RoA</h3>
          <p className="text-sm text-muted-foreground text-center mb-6 max-w-md">
            Begin a new Record of Advice from scratch. Our guided process ensures compliance and completeness.
          </p>
          <Button onClick={onCreateNew} size="lg" className="px-8">
            <Plus className="h-4 w-4 mr-2" />
            Begin RoA Draft
          </Button>
        </CardContent>
      </Card>

      {/* Existing Drafts */}
      {isLoadingDrafts && (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">Loading saved RoA drafts...</CardContent>
        </Card>
      )}

      {existingDrafts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Resume Existing Drafts</h3>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            {existingDrafts.map((draft) => {
              const completion = getCompletionStatus(draft);
              const completionPercentage = completion.total > 0 
                ? Math.round((completion.completed / completion.total) * 100)
                : 0;

              return (
                <Card key={draft.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div
                      className="flex cursor-pointer items-start justify-between"
                      onClick={() => onResume(draft)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onResume(draft);
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="space-y-1">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {getClientName(draft)}
                        </CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>Updated {formatLastUpdated(draft.updatedAt)}</span>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        v{draft.version}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* Progress */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{completionPercentage}% complete</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${completionPercentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Modules */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Selected Modules:</p>
                      <div className="flex flex-wrap gap-1">
                        {draft.selectedModules.slice(0, 3).map((moduleId) => (
                          <Badge key={moduleId} variant="outline" className="text-xs">
                            {moduleId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Badge>
                        ))}
                        {draft.selectedModules.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{draft.selectedModules.length - 3} more
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Resume Button */}
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => onResume(draft)}
                    >
                      Resume Draft
                    </Button>
                    {onDiscardDraft && (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        disabled={discardingDraftId === draft.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          void onDiscardDraft(draft);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        {discardingDraftId === draft.id ? 'Discarding…' : 'Discard draft'}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {finalisedDrafts.length > 0 && onResumeFinal && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Finalised RoAs</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Final records are read-only. Open one to download documents or branch a new editable version from the review step.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {finalisedDrafts.map((draft) => (
              <Card key={draft.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {getClientName(draft)}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>
                          Finalised {formatLastUpdated(draft.finalisedAt ?? draft.updatedAt)}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="shrink-0 border-green-200 bg-green-50 text-green-800">
                      Final v{draft.version}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" onClick={() => onResumeFinal(draft)}>
                    View final RoA
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Info Section */}
      <Card className="bg-muted/30">
        <CardContent className="p-6">
          <h3 className="font-semibold mb-3">What you'll create:</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Compliant Documentation</p>
                <p className="text-xs text-muted-foreground">Full FAIS-compliant Record of Advice with required disclosures</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Client-Specific</p>
                <p className="text-xs text-muted-foreground">Tailored to your client's specific circumstances and needs</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
