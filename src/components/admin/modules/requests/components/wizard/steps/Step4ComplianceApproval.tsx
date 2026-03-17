import React from 'react';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { RequestTemplate, ComplianceChecklistItem } from '../../../types';

interface Step4ComplianceApprovalProps {
  templateData: Partial<RequestTemplate>;
  updateTemplateData: (updates: Partial<RequestTemplate>) => void;
}

export function Step4ComplianceApproval({
  templateData,
  updateTemplateData,
}: Step4ComplianceApprovalProps) {
  const config = templateData.complianceApprovalConfig || {
    enabled: false,
    checklistItems: [],
  };

  const updateConfig = (updates: Partial<typeof config>) => {
    updateTemplateData({
      complianceApprovalConfig: { ...config, ...updates },
    });
  };

  const addChecklistItem = () => {
    const newItem: ComplianceChecklistItem = {
      id: `checklist_${Date.now()}`,
      description: '',
      requiresEvidence: false,
      completionRole: 'Admin',
      order: config.checklistItems.length,
    };

    updateConfig({
      checklistItems: [...config.checklistItems, newItem],
    });
  };

  const updateChecklistItem = (id: string, updates: Partial<ComplianceChecklistItem>) => {
    updateConfig({
      checklistItems: config.checklistItems.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    });
  };

  const deleteChecklistItem = (id: string) => {
    updateConfig({
      checklistItems: config.checklistItems.filter((item) => item.id !== id),
    });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h3 className="text-lg text-slate-900 mb-2">Compliance Approval (Optional)</h3>
        <p className="text-sm text-slate-600">
          Configure compliance checks that must be completed before a request enters the lifecycle
          workflow.
        </p>
      </div>

      <div className="space-y-6">
        {/* Enable Compliance Approval */}
        <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <input
            type="checkbox"
            id="complianceEnabled"
            checked={config.enabled}
            onChange={(e) => updateConfig({ enabled: e.target.checked })}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-1"
          />
          <div className="flex-1">
            <label htmlFor="complianceEnabled" className="text-sm text-slate-900 cursor-pointer">
              Enable Compliance Approval
            </label>
            <p className="text-xs text-slate-500 mt-1">
              Require compliance checklist completion before requests can proceed to lifecycle
              stages
            </p>
          </div>
        </div>

        {/* Checklist Items */}
        {config.enabled && (
          <div>
            <label className="block text-sm text-slate-700 mb-3">Compliance Checklist</label>
            <p className="text-xs text-slate-500 mb-3">
              Define the compliance checks that must be verified before lifecycle begins
            </p>

            <div className="space-y-2 mb-3">
              {config.checklistItems.map((item, index) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 p-4 bg-white rounded-lg border border-slate-200"
                >
                  <GripVertical className="w-4 h-4 text-slate-400 cursor-move mt-1 flex-shrink-0" />

                  <div className="flex-1 space-y-3">
                    <div>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(e) =>
                          updateChecklistItem(item.id, { description: e.target.value })
                        }
                        placeholder="Checklist item description..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                      />
                    </div>

                    <div className="flex items-center gap-6">
                      <label className="flex items-center gap-2 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={item.requiresEvidence}
                          onChange={(e) =>
                            updateChecklistItem(item.id, { requiresEvidence: e.target.checked })
                          }
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        Requires Evidence Document
                      </label>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-600">Completion Role:</span>
                        <select
                          value={item.completionRole}
                          onChange={(e) =>
                            updateChecklistItem(item.id, {
                              completionRole: e.target.value as 'Admin' | 'Adviser' | 'Compliance Officer',
                            })
                          }
                          className="px-2 py-1 border border-slate-200 rounded text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="Admin">Admin</option>
                          <option value="Adviser">Adviser</option>
                          <option value="Compliance Officer">Compliance Officer</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => deleteChecklistItem(item.id)}
                    className="p-2 hover:bg-red-50 rounded transition-colors flex-shrink-0"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={addChecklistItem}
              className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:border-slate-400 hover:text-slate-700 transition-colors"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Add Checklist Item
            </button>
          </div>
        )}

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
              <h4 className="text-sm text-blue-900 mb-1">About Compliance Approval</h4>
              <p className="text-xs text-blue-700">
                Compliance approval happens <strong>before</strong> a request enters the lifecycle
                workflow. This ensures all necessary checks are completed upfront. For example:
                verifying client identity documents, checking regulatory requirements, or
                confirming data completeness.
              </p>
              <p className="text-xs text-blue-700 mt-2">
                <strong>Note:</strong> This is different from Compliance Sign-Off (Step 6), which
                happens at the end of the lifecycle.
              </p>
            </div>
          </div>
        </div>

        {/* Example Checklist */}
        {config.enabled && config.checklistItems.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="text-sm text-amber-900 mb-2">Need Ideas? Common Checklist Items:</h4>
            <ul className="text-xs text-amber-700 space-y-1 ml-4 list-disc">
              <li>Client ID document verified and uploaded</li>
              <li>Proof of bank account received</li>
              <li>Tax clearance certificate on file</li>
              <li>FICA/KYC documentation complete</li>
              <li>Policy documents reviewed</li>
              <li>Regulatory requirements checked</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}