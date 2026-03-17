import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { RequestTemplate } from '../../../types';

interface Step7FinalisationProps {
  templateData: Partial<RequestTemplate>;
  updateTemplateData: (updates: Partial<RequestTemplate>) => void;
}

export function Step7Finalisation({ templateData, updateTemplateData }: Step7FinalisationProps) {
  const config = templateData.finalisationConfig || {
    completionStateLabel: 'Completed',
    lockAfterCompletion: true,
    requiredFinalDocuments: [],
    sendCompletionEmail: false,
  };

  const updateConfig = (updates: Partial<typeof config>) => {
    updateTemplateData({
      finalisationConfig: { ...config, ...updates },
    });
  };

  const addRequiredDocument = () => {
    updateConfig({
      requiredFinalDocuments: [...config.requiredFinalDocuments, ''],
    });
  };

  const updateRequiredDocument = (index: number, value: string) => {
    const newDocs = [...config.requiredFinalDocuments];
    newDocs[index] = value;
    updateConfig({ requiredFinalDocuments: newDocs });
  };

  const deleteRequiredDocument = (index: number) => {
    updateConfig({
      requiredFinalDocuments: config.requiredFinalDocuments.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h3 className="text-lg text-slate-900 mb-2">Finalisation Rules</h3>
        <p className="text-sm text-slate-600">
          Configure how requests are finalised and what happens when they're completed.
        </p>
      </div>

      <div className="space-y-6">
        {/* Completion State Label */}
        <div>
          <label className="block text-sm text-slate-700 mb-2">
            Completion State Label
          </label>
          <input
            type="text"
            value={config.completionStateLabel}
            onChange={(e) => updateConfig({ completionStateLabel: e.target.value })}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="e.g., Completed, Closed, Archived"
          />
          <p className="text-xs text-slate-500 mt-1">
            The label shown when a request is finalised (default: "Completed")
          </p>
        </div>

        {/* Lock After Completion */}
        <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <input
            type="checkbox"
            id="lockAfterCompletion"
            checked={config.lockAfterCompletion}
            onChange={(e) => updateConfig({ lockAfterCompletion: e.target.checked })}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-1"
          />
          <div className="flex-1">
            <label htmlFor="lockAfterCompletion" className="text-sm text-slate-900 cursor-pointer">
              Lock Request After Completion
            </label>
            <p className="text-xs text-slate-500 mt-1">
              Prevent any further edits or changes once a request is finalised (recommended for
              audit trail)
            </p>
          </div>
        </div>

        {/* Required Final Documents */}
        <div>
          <label className="block text-sm text-slate-700 mb-2">
            Required Final Documents <span className="text-slate-400">(Optional)</span>
          </label>
          <p className="text-xs text-slate-500 mb-3">
            Specify documents that must be attached before a request can be finalised
          </p>

          <div className="space-y-2 mb-3">
            {config.requiredFinalDocuments.map((doc, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={doc}
                  onChange={(e) => updateRequiredDocument(index, e.target.value)}
                  placeholder="e.g., Signed Contract, Proof of Payment"
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  onClick={() => deleteRequiredDocument(index)}
                  className="p-2 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addRequiredDocument}
            className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:border-slate-400 hover:text-slate-700 transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Add Required Document
          </button>
        </div>

        {/* Send Completion Email */}
        <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="sendCompletionEmail"
              checked={config.sendCompletionEmail}
              onChange={(e) => updateConfig({ sendCompletionEmail: e.target.checked })}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-1"
            />
            <div className="flex-1">
              <label htmlFor="sendCompletionEmail" className="text-sm text-slate-900 cursor-pointer">
                Send Completion Email
              </label>
              <p className="text-xs text-slate-500 mt-1">
                Automatically notify relevant parties when a request is finalised
              </p>
            </div>
          </div>

          {config.sendCompletionEmail && (
            <div className="ml-6">
              <label className="block text-xs text-slate-700 mb-1">
                Email Template <span className="text-slate-400">(Optional)</span>
              </label>
              <input
                type="text"
                value={config.completionEmailTemplate || ''}
                onChange={(e) => updateConfig({ completionEmailTemplate: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="e.g., request-completed-notification"
              />
              <p className="text-xs text-slate-500 mt-1">
                Reference to an email template (to be configured in communication settings)
              </p>
            </div>
          )}
        </div>

        {/* PDF Output Configuration */}
        <div>
          <label className="block text-sm text-slate-700 mb-3">PDF Output Configuration</label>
          <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div>
              <label className="block text-xs text-slate-700 mb-1">Template Version</label>
              <input
                type="text"
                value={templateData.pdfOutputConfig?.templateVersion || '1.0'}
                onChange={(e) =>
                  updateTemplateData({
                    pdfOutputConfig: {
                      ...(templateData.pdfOutputConfig || {
                        includeSections: [],
                        includeAuditLog: true,
                      }),
                      templateVersion: e.target.value,
                    },
                  })
                }
                className="w-32 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                placeholder="1.0"
              />
              <p className="text-xs text-slate-500 mt-1">
                Version identifier for PDF template (for tracking changes)
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="includeAuditLog"
                checked={templateData.pdfOutputConfig?.includeAuditLog !== false}
                onChange={(e) =>
                  updateTemplateData({
                    pdfOutputConfig: {
                      ...(templateData.pdfOutputConfig || {
                        templateVersion: '1.0',
                        includeSections: [],
                      }),
                      includeAuditLog: e.target.checked,
                    },
                  })
                }
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="includeAuditLog" className="text-sm text-slate-700">
                Include Audit Log in PDF Export
              </label>
            </div>
          </div>
        </div>

        {/* Summary Box */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-sm text-green-900 mb-1">Template Configuration Complete!</h4>
              <p className="text-xs text-green-700">
                You've configured all aspects of your request template. Review your settings and
                click "Create Template" or "Update Template" to save.
              </p>
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-sm text-blue-900 mb-1">What Happens Next</h4>
              <p className="text-xs text-blue-700 mb-2">
                Once you save this template:
              </p>
              <ul className="text-xs text-blue-700 space-y-1 ml-4 list-disc">
                <li>It will appear in your template library</li>
                <li>
                  If status is "Active", you can immediately start creating requests from it
                </li>
                <li>You can always edit the template (with versioning for active templates)</li>
                <li>All requests created from this template will follow the workflow you defined</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Template Summary Preview */}
        <div className="bg-white border border-slate-300 rounded-lg p-4">
          <h4 className="text-sm text-slate-900 mb-3">Template Summary</h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <span className="text-slate-500">Name:</span>{' '}
              <span className="text-slate-900">{templateData.name || 'Not set'}</span>
            </div>
            <div>
              <span className="text-slate-500">Category:</span>{' '}
              <span className="text-slate-900">{templateData.category || 'Not set'}</span>
            </div>
            <div>
              <span className="text-slate-500">Request Details:</span>{' '}
              <span className="text-slate-900">
                {templateData.requestDetailsSchema?.length || 0} section
                {templateData.requestDetailsSchema?.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Lifecycle Stages:</span>{' '}
              <span className="text-slate-900">
                {templateData.lifecycleConfiguration?.stages.length || 0} stage
                {templateData.lifecycleConfiguration?.stages.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Compliance Approval:</span>{' '}
              <span className="text-slate-900">
                {templateData.complianceApprovalConfig?.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Compliance Sign-Off:</span>{' '}
              <span className="text-slate-900">
                {templateData.complianceSignOffConfig?.enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
