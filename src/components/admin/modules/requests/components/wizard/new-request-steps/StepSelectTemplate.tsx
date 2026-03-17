import React, { useState } from 'react';
import { Search, FileText, CheckCircle2 } from 'lucide-react';
import { Input } from '../../../../../../ui/input';
import { RequestTemplate, RequestCategory, TemplateStatus, ClientAssociationRule } from '../../../types';
import { CategoryBadge } from '../../shared/CategoryBadge';
import { useTemplates } from '../../../hooks/useTemplates';

interface StepSelectTemplateProps {
  selectedTemplate: RequestTemplate | null;
  onSelectTemplate: (template: RequestTemplate) => void;
}

export function StepSelectTemplate({ selectedTemplate, onSelectTemplate }: StepSelectTemplateProps) {
  const { templates = [], loading } = useTemplates();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<RequestCategory | 'all'>('all');
  const [showDrafts, setShowDrafts] = useState(false);

  // Filter templates
  const filteredTemplates = (templates || []).filter(template => {
    // Status Filter
    const status = (template.status || '').toLowerCase();
    const isActive = status === 'active';
    const isDraft = status === 'draft';
    
    // By default, only show Active templates unless "Show Drafts" is checked
    if (!isActive && !(showDrafts && isDraft)) {
       return false;
    }

    // Search Filter
    const matchesSearch = !searchQuery || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Category Filter
    // Ensure robust matching by normalizing case
    const templateCategory = (template.category || '').toLowerCase();
    const filterCategory = categoryFilter === 'all' ? 'all' : categoryFilter.toLowerCase();
    
    const matchesCategory = categoryFilter === 'all' || templateCategory === filterCategory;
    
    return matchesSearch && matchesCategory;
  });

  const categories = Object.values(RequestCategory);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium mb-1">Select a Request Template</h3>
        <p className="text-sm text-muted-foreground">
          Choose the template that best matches the type of request you need to create.
        </p>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as RequestCategory | 'all')}
            className="px-3 py-2 border border-slate-300 rounded-md text-sm bg-white"
          >
            <option value="all">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
           <input 
             type="checkbox" 
             id="showDrafts" 
             checked={showDrafts} 
             onChange={(e) => setShowDrafts(e.target.checked)}
             className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
           />
           <label htmlFor="showDrafts" className="text-sm text-slate-600 cursor-pointer select-none">
             Show draft templates
           </label>
        </div>
      </div>

      {/* Templates List */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {loading ? (
          <div className="text-center py-8 text-slate-500">Loading templates...</div>
        ) : filteredTemplates.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm">No templates found</p>
          </div>
        ) : (
          filteredTemplates.map((template) => {
            const isSelected = selectedTemplate?.id === template.id;
            const lifecycleStageCount = template.lifecycleConfiguration.stages.length;
            
            return (
              <button
                key={template.id}
                onClick={() => onSelectTemplate(template)}
                className={`w-full text-left p-4 border rounded-lg transition-all hover:border-blue-300 hover:shadow-sm ${
                  isSelected 
                    ? 'border-blue-500 bg-blue-50 shadow-sm' 
                    : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium text-slate-900">{template.name}</h4>
                      {isSelected && (
                        <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-3 mb-2">
                      <CategoryBadge category={template.category} />
                      <span className="text-xs text-slate-500">
                        {template.requestType}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mt-3 text-xs text-slate-600">
                      <div>
                        <span className="block text-slate-400 mb-1">Client Association</span>
                        <span className={`font-medium ${
                          template.clientAssociationRule === ClientAssociationRule.REQUIRED 
                            ? 'text-orange-600' 
                            : 'text-slate-600'
                        }`}>
                          {template.clientAssociationRule}
                        </span>
                      </div>
                      
                      <div>
                        <span className="block text-slate-400 mb-1">Lifecycle Stages</span>
                        <span className="font-medium">{lifecycleStageCount} stages</span>
                      </div>
                      
                      <div>
                        <span className="block text-slate-400 mb-1">Compliance</span>
                        <span className="font-medium">
                          {template.complianceApprovalConfig.enabled && template.complianceSignOffConfig.enabled
                            ? 'Approval + Sign-off'
                            : template.complianceApprovalConfig.enabled
                            ? 'Approval only'
                            : template.complianceSignOffConfig.enabled
                            ? 'Sign-off only'
                            : 'None'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {selectedTemplate && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-blue-900 mb-1">Template Selected</h4>
              <p className="text-sm text-blue-700">
                <strong>{selectedTemplate.name}</strong> — {selectedTemplate.category}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}