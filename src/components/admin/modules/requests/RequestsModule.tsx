import React, { useState } from 'react';
import { Button } from '../../../ui/button';
import { Plus, Settings, LayoutTemplate, ArrowLeft } from 'lucide-react';
import { TemplateListView } from './components/templates/TemplateListView';
import { TemplateWizard } from './components/wizard/TemplateWizard';
import { NewRequestWizard } from './components/wizard/NewRequestWizard';
import { RequestBoardView } from './components/requests/RequestBoardView';
import { RequestTemplate, Request } from './types';
import { useCurrentUserPermissions } from '../personnel/hooks/usePermissions';

/**
 * Requests Module - Redesigned
 * 
 * CORE PRINCIPLE:
 * - Requests (execution) = Primary, default view
 * - Templates (configuration) = Secondary view
 * 
 * Features:
 * - Request Manager: Kanban board (New, Pending, Completed)
 * - New Request Wizard: Template-driven request creation flow
 * - Template Manager: Configuration surface for defining request blueprints
 * - Clean separation between execution and configuration
 */

export function RequestsModule() {
  const [viewMode, setViewMode] = useState<'requests' | 'templates'>('requests');
  const [showNewRequestWizard, setShowNewRequestWizard] = useState(false);
  const [showTemplateWizard, setShowTemplateWizard] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RequestTemplate | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<Request | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { canDo } = useCurrentUserPermissions();

  const canCreate = canDo('quotes', 'create');
  const canEdit = canDo('quotes', 'edit');

  // ============================================================================
  // REQUESTS HANDLERS (Primary - Execution)
  // ============================================================================

  const handleCreateRequest = () => {
    setShowNewRequestWizard(true);
  };

  const handleNewRequestSuccess = (request: Request) => {
    setShowNewRequestWizard(false);
    setRefreshKey(prev => prev + 1);
    // TODO: Show success toast
    console.log('Request created:', request);
  };

  const handleViewRequest = (request: Request) => {
    // TODO: Implement request details view/drawer
    setSelectedRequest(request);
    alert(`Viewing request ${request.id} - Details view coming soon!`);
  };

  // ============================================================================
  // TEMPLATES HANDLERS (Secondary - Configuration)
  // ============================================================================

  const handleCreateTemplate = () => {
    setSelectedTemplate(null);
    setShowTemplateWizard(true);
  };

  const handleEditTemplate = (template: RequestTemplate) => {
    setSelectedTemplate(template);
    setShowTemplateWizard(true);
  };

  const handleCloseTemplateWizard = () => {
    setShowTemplateWizard(false);
    setSelectedTemplate(null);
  };

  const handleTemplateSuccess = () => {
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-6 p-6">
      {/* ========================================================================
          HEADER - Dynamic based on active view
          ======================================================================== */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {viewMode === 'requests' ? 'Requests' : 'Request Templates'}
          </h2>
          <p className="text-muted-foreground">
            {viewMode === 'requests' 
              ? 'Manage and track active requests through your workflow.'
              : 'Configure request templates and define workflow rules.'}
          </p>
        </div>
        
        {/* Primary CTA - Changes based on active view */}
        <div className="flex items-center gap-2">
          {viewMode === 'requests' ? (
            <div className="contents">
              <Button 
                onClick={() => setViewMode('templates')} 
                variant="outline"
              >
                <LayoutTemplate className="mr-2 h-4 w-4" />
                Templates
              </Button>
              <Button onClick={handleCreateRequest} size="lg" disabled={!canCreate}>
                <Plus className="mr-2 h-4 w-4" />
                New Request
              </Button>
            </div>
          ) : (
            <div className="contents">
              <Button 
                onClick={() => setViewMode('requests')} 
                variant="outline"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Requests
              </Button>
              <Button onClick={handleCreateTemplate}>
                <Plus className="mr-2 h-4 w-4" />
                Create Template
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================
          CONTENT AREA
          ======================================================================== */}
      
      {viewMode === 'requests' ? (
        <RequestBoardView
          key={`requests-${refreshKey}`}
          onCreateRequest={handleCreateRequest}
          onViewRequest={handleViewRequest}
        />
      ) : (
        <TemplateListView
          key={`templates-${refreshKey}`}
          onCreateTemplate={handleCreateTemplate}
          onEditTemplate={handleEditTemplate}
        />
      )}

      {/* ========================================================================
          MODALS/WIZARDS
          ======================================================================== */}

      {/* New Request Wizard - Template-driven request creation */}
      {showNewRequestWizard && (
        <NewRequestWizard
          onClose={() => setShowNewRequestWizard(false)}
          onSuccess={handleNewRequestSuccess}
        />
      )}

      {/* Template Wizard - Configuration */}
      {showTemplateWizard && (
        <TemplateWizard
          template={selectedTemplate}
          onClose={handleCloseTemplateWizard}
          onSuccess={handleTemplateSuccess}
        />
      )}
    </div>
  );
}