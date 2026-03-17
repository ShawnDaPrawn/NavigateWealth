import React from 'react';
import { CheckCircle2, User, FileText, AlertCircle, Shield, Workflow } from 'lucide-react';
import { RequestPriority, RequestTemplate, RequestFieldSection, RequestField, LifecycleStage } from '../../../types';
import { CategoryBadge } from '../../shared/CategoryBadge';

interface RequestDraftSummary {
  template: RequestTemplate | null;
  clientName: string | null;
  requestSubject: string | null;
  requestDetails: Record<string, string | number | boolean | null>;
  assignees: string[];
  priority: RequestPriority;
}

interface StepReviewProps {
  draft: RequestDraftSummary;
  onUpdatePriority: (priority: RequestPriority) => void;
}

export function StepReview({ draft, onUpdatePriority }: StepReviewProps) {
  const { template, clientName, requestSubject, requestDetails, assignees, priority } = draft;

  if (!template) {
    return <div>Error: No template selected</div>;
  }

  const assigneeCount = assignees.length;
  const requiredFieldsCount = template.requestDetailsSchema.reduce(
    (count: number, section: RequestFieldSection) => count + section.fields.filter((f: RequestField) => f.required).length,
    0
  );
  const completedFieldsCount = Object.keys(requestDetails).filter(
    key => requestDetails[key] !== null && requestDetails[key] !== ''
  ).length;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-1">Review & Create</h3>
        <p className="text-sm text-muted-foreground">
          Please review the request details before creating.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        {/* Template Info */}
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0">
              <FileText className="h-5 w-5 text-blue-700" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-blue-900 mb-1">Template</h4>
              <p className="font-medium text-blue-800 truncate">{template.name}</p>
              <div className="mt-2">
                <CategoryBadge category={template.category} />
              </div>
            </div>
          </div>
        </div>

        {/* Client Info */}
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-green-200 flex items-center justify-center flex-shrink-0">
              <User className="h-5 w-5 text-green-700" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-green-900 mb-1">
                {clientName ? 'Client' : 'Subject'}
              </h4>
              <p className="font-medium text-green-800 truncate">
                {clientName || requestSubject || 'Not specified'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Priority Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          Priority
        </label>
        <div className="grid grid-cols-4 gap-2">
          {Object.values(RequestPriority).map((p) => (
            <button
              key={p}
              onClick={() => onUpdatePriority(p)}
              className={`px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                priority === p
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Request Details Summary */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
          <h4 className="font-medium text-slate-900">Request Details</h4>
        </div>
        <div className="p-4 space-y-3">
          {template.requestDetailsSchema.length === 0 ? (
            <p className="text-sm text-slate-500">No request details configured</p>
          ) : (
            template.requestDetailsSchema.map((section: RequestFieldSection) => (
              <div key={section.id}>
                <h5 className="text-sm font-medium text-slate-700 mb-2">{section.name}</h5>
                <div className="space-y-1">
                  {section.fields.map((field: RequestField) => {
                    const value = requestDetails[field.key];
                    const displayValue = value !== undefined && value !== null && value !== ''
                      ? Array.isArray(value)
                        ? value.join(', ')
                        : String(value)
                      : '—';

                    return (
                      <div key={field.id} className="flex justify-between text-sm py-1">
                        <span className="text-slate-600">{field.label}:</span>
                        <span className="font-medium text-slate-900 text-right max-w-xs truncate">
                          {displayValue}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Assignees */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
          <h4 className="font-medium text-slate-900">
            Assignees ({assigneeCount})
          </h4>
        </div>
        <div className="p-4">
          {assigneeCount === 0 ? (
            <p className="text-sm text-slate-500">No assignees selected</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {assignees.map((userId: string) => (
                <div
                  key={userId}
                  className="px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-sm"
                >
                  User {userId}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Workflow Preview */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <div className="bg-slate-50 px-4 py-3 border-b border-slate-200">
          <h4 className="font-medium text-slate-900">Workflow Overview</h4>
        </div>
        <div className="p-4 space-y-3">
          {/* Compliance Approval */}
          {template.complianceApprovalConfig.enabled && (
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="text-sm font-medium text-slate-900">Pre-Lifecycle Compliance Approval</h5>
                <p className="text-xs text-slate-600 mt-1">
                  {template.complianceApprovalConfig.checklistItems.length} checklist items must be completed
                </p>
              </div>
            </div>
          )}

          {/* Lifecycle */}
          <div className="flex items-start gap-3">
            <Workflow className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <h5 className="text-sm font-medium text-slate-900">Lifecycle Stages</h5>
              <p className="text-xs text-slate-600 mt-1">
                {template.lifecycleConfiguration.stages.length} stages defined
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                {template.lifecycleConfiguration.stages.slice(0, 5).map((stage: LifecycleStage, index: number) => (
                  <span key={stage.id} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {index + 1}. {stage.name}
                  </span>
                ))}
                {template.lifecycleConfiguration.stages.length > 5 && (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded">
                    +{template.lifecycleConfiguration.stages.length - 5} more
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Compliance Sign-Off */}
          {template.complianceSignOffConfig.enabled && (
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="text-sm font-medium text-slate-900">Post-Lifecycle Compliance Sign-Off</h5>
                <p className="text-xs text-slate-600 mt-1">
                  Approver: {template.complianceSignOffConfig.approverRole}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Final Notice */}
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-green-900 mb-1">Ready to Create</h4>
            <p className="text-sm text-green-800">
              Once created, this request will be placed in the <strong>New</strong> lane and will
              appear on the Requests board. You can then start the lifecycle process.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}