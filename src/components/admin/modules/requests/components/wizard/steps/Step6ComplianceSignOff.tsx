import React from 'react';
import { RequestTemplate } from '../../../types';

interface Step6ComplianceSignOffProps {
  templateData: Partial<RequestTemplate>;
  updateTemplateData: (updates: Partial<RequestTemplate>) => void;
}

export function Step6ComplianceSignOff({
  templateData,
  updateTemplateData,
}: Step6ComplianceSignOffProps) {
  const config = templateData.complianceSignOffConfig || {
    enabled: false,
    approverRole: 'Super Admin' as const,
    deficiencyWorkflow: {
      allowDeficiencies: true,
      requireRemedialDocuments: false,
      requireRemedialComments: false,
    },
  };

  const updateConfig = (updates: Partial<typeof config>) => {
    updateTemplateData({
      complianceSignOffConfig: { ...config, ...updates },
    });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h3 className="text-lg text-slate-900 mb-2">Compliance Sign-Off (Optional)</h3>
        <p className="text-sm text-slate-600">
          Configure final compliance approval that happens <strong>after</strong> the lifecycle is
          complete but <strong>before</strong> finalisation.
        </p>
      </div>

      <div className="space-y-6">
        {/* Enable Compliance Sign-Off */}
        <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <input
            type="checkbox"
            id="signOffEnabled"
            checked={config.enabled}
            onChange={(e) => updateConfig({ enabled: e.target.checked })}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-1"
          />
          <div className="flex-1">
            <label htmlFor="signOffEnabled" className="text-sm text-slate-900 cursor-pointer">
              Require Compliance Sign-Off
            </label>
            <p className="text-xs text-slate-500 mt-1">
              A compliance officer must review and approve the completed request before it can be
              finalised
            </p>
          </div>
        </div>

        {config.enabled && (
          <div className="contents">
            {/* Approver Role */}
            <div>
              <label className="block text-sm text-slate-700 mb-2">Approver Role</label>
              <div className="space-y-2">
                {['Super Admin', 'Compliance Officer', 'Named User'].map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() =>
                      updateConfig({ approverRole: role as 'Super Admin' | 'Compliance Officer' | 'Named User' })
                    }
                    className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                      config.approverRole === role
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                          config.approverRole === role ? 'border-indigo-500' : 'border-slate-300'
                        }`}
                      >
                        {config.approverRole === role && (
                          <div className="w-2 h-2 rounded-full bg-indigo-500" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm text-slate-900">{role}</div>
                        <div className="text-xs text-slate-500 mt-1">
                          {role === 'Super Admin' &&
                            'Only super administrators can approve compliance sign-off'}
                          {role === 'Compliance Officer' &&
                            'Any user with Compliance Officer role can approve'}
                          {role === 'Named User' &&
                            'Specify a particular user who must approve (configured later)'}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Named User Input */}
            {config.approverRole === 'Named User' && (
              <div>
                <label className="block text-sm text-slate-700 mb-2">Approver User ID</label>
                <input
                  type="text"
                  value={config.approverUserId || ''}
                  onChange={(e) => updateConfig({ approverUserId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter user ID..."
                />
                <p className="text-xs text-slate-500 mt-1">
                  The specific user who must approve compliance sign-off
                </p>
              </div>
            )}

            {/* Deficiency Workflow */}
            <div>
              <label className="block text-sm text-slate-700 mb-3">Deficiency Workflow</label>
              <p className="text-xs text-slate-500 mb-3">
                Configure what happens when the compliance officer identifies issues
              </p>

              <div className="space-y-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="allowDeficiencies"
                    checked={config.deficiencyWorkflow.allowDeficiencies}
                    onChange={(e) =>
                      updateConfig({
                        deficiencyWorkflow: {
                          ...config.deficiencyWorkflow,
                          allowDeficiencies: e.target.checked,
                        },
                      })
                    }
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-1"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="allowDeficiencies"
                      className="text-sm text-slate-900 cursor-pointer"
                    >
                      Allow "Deficient" Status
                    </label>
                    <p className="text-xs text-slate-500 mt-1">
                      Compliance officers can mark requests as deficient rather than simply
                      rejecting them
                    </p>
                  </div>
                </div>

                {config.deficiencyWorkflow.allowDeficiencies && (
                  <div className="contents">
                    <div className="flex items-start gap-3 ml-6">
                      <input
                        type="checkbox"
                        id="requireDocs"
                        checked={config.deficiencyWorkflow.requireRemedialDocuments}
                        onChange={(e) =>
                          updateConfig({
                            deficiencyWorkflow: {
                              ...config.deficiencyWorkflow,
                              requireRemedialDocuments: e.target.checked,
                            },
                          })
                        }
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-1"
                      />
                      <div className="flex-1">
                        <label htmlFor="requireDocs" className="text-sm text-slate-900 cursor-pointer">
                          Require Remedial Documents
                        </label>
                        <p className="text-xs text-slate-500 mt-1">
                          Assignees must upload documents to address deficiencies
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3 ml-6">
                      <input
                        type="checkbox"
                        id="requireComments"
                        checked={config.deficiencyWorkflow.requireRemedialComments}
                        onChange={(e) =>
                          updateConfig({
                            deficiencyWorkflow: {
                              ...config.deficiencyWorkflow,
                              requireRemedialComments: e.target.checked,
                            },
                          })
                        }
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-1"
                      />
                      <div className="flex-1">
                        <label
                          htmlFor="requireComments"
                          className="text-sm text-slate-900 cursor-pointer"
                        >
                          Require Remedial Comments
                        </label>
                        <p className="text-xs text-slate-500 mt-1">
                          Assignees must provide written explanations for deficiency resolution
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Info Boxes */}
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
              <h4 className="text-sm text-blue-900 mb-1">When to Use Compliance Sign-Off</h4>
              <p className="text-xs text-blue-700">
                Use compliance sign-off when completed requests need final regulatory or legal
                review before being closed. This is common for:
              </p>
              <ul className="text-xs text-blue-700 mt-2 space-y-1 ml-4 list-disc">
                <li>Financial product applications requiring FAIS compliance</li>
                <li>Requests involving client data or privacy concerns</li>
                <li>High-value transactions requiring additional oversight</li>
                <li>Regulatory filings and submissions</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex gap-3">
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <h4 className="text-sm text-amber-900 mb-1">Compliance Sign-Off vs. Compliance Approval</h4>
              <p className="text-xs text-amber-700">
                <strong>Compliance Approval (Step 4)</strong> happens at the <em>start</em> before
                lifecycle begins.
                <br />
                <strong>Compliance Sign-Off (Step 6)</strong> happens at the <em>end</em> after
                lifecycle completes.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}