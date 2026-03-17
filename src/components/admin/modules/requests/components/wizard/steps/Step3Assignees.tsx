import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { RequestTemplate, AssigneeRole, AssignmentRule } from '../../../types';

interface Step3AssigneesProps {
  templateData: Partial<RequestTemplate>;
  updateTemplateData: (updates: Partial<RequestTemplate>) => void;
}

const ROLE_OPTIONS = ['Admin', 'Adviser', 'Compliance Officer', 'External'] as const;

export function Step3Assignees({ templateData, updateTemplateData }: Step3AssigneesProps) {
  const config = templateData.assigneeConfiguration || {
    defaultRoles: [],
    assignmentRule: AssignmentRule.MANUAL_REQUIRED,
    allowExternalAssignees: false,
    reminderConfig: {
      enabled: false,
      intervalHours: 48,
      sendToInternal: true,
      sendToExternal: false,
    },
  };

  const updateConfig = (updates: Partial<typeof config>) => {
    updateTemplateData({
      assigneeConfiguration: { ...config, ...updates },
    });
  };

  const addRole = () => {
    const newRole: AssigneeRole = {
      role: 'Admin',
      required: false,
    };

    updateConfig({
      defaultRoles: [...config.defaultRoles, newRole],
    });
  };

  const updateRole = (index: number, updates: Partial<AssigneeRole>) => {
    const newRoles = [...config.defaultRoles];
    newRoles[index] = { ...newRoles[index], ...updates };
    updateConfig({ defaultRoles: newRoles });
  };

  const removeRole = (index: number) => {
    updateConfig({
      defaultRoles: config.defaultRoles.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h3 className="text-lg text-slate-900 mb-2">Assignees & Responsibility</h3>
        <p className="text-sm text-slate-600">
          Configure who will be assigned to requests and how assignments are handled.
        </p>
      </div>

      <div className="space-y-6">
        {/* Assignment Rule */}
        <div>
          <label className="block text-sm text-slate-700 mb-2">Assignment Rule</label>
          <div className="space-y-2">
            {Object.values(AssignmentRule).map((rule) => (
              <button
                key={rule}
                type="button"
                onClick={() => updateConfig({ assignmentRule: rule })}
                className={`w-full p-3 border-2 rounded-lg text-left transition-all ${
                  config.assignmentRule === rule
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <div
                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mt-0.5 flex-shrink-0 ${
                      config.assignmentRule === rule ? 'border-indigo-500' : 'border-slate-300'
                    }`}
                  >
                    {config.assignmentRule === rule && (
                      <div className="w-2 h-2 rounded-full bg-indigo-500" />
                    )}
                  </div>
                  <div>
                    <div className="text-sm text-slate-900">{rule}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {rule === AssignmentRule.AUTO_ASSIGN_OWNER &&
                        'New requests are automatically assigned to the template owner'}
                      {rule === AssignmentRule.AUTO_ASSIGN_ROUND_ROBIN &&
                        'Requests are distributed evenly among eligible team members'}
                      {rule === AssignmentRule.MANUAL_REQUIRED &&
                        'Admin must manually assign each request'}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Default Roles */}
        <div>
          <label className="block text-sm text-slate-700 mb-2">Default Assignee Roles</label>
          <p className="text-xs text-slate-500 mb-3">
            Define which roles should be assigned to requests by default
          </p>

          <div className="space-y-2 mb-3">
            {config.defaultRoles.map((role, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200"
              >
                <select
                  value={role.role}
                  onChange={(e) =>
                    updateRole(index, { role: e.target.value as 'Admin' | 'Adviser' | 'Compliance Officer' | 'External' })
                  }
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-2 text-sm text-slate-700 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={role.required}
                    onChange={(e) => updateRole(index, { required: e.target.checked })}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Required
                </label>

                <button
                  onClick={() => removeRole(index)}
                  className="p-2 hover:bg-red-50 rounded transition-colors"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addRole}
            className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:border-slate-400 hover:text-slate-700 transition-colors"
          >
            <Plus className="w-4 h-4 inline mr-2" />
            Add Role
          </button>
        </div>

        {/* Allow External Assignees */}
        <div className="flex items-start gap-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <input
            type="checkbox"
            id="allowExternal"
            checked={config.allowExternalAssignees}
            onChange={(e) => updateConfig({ allowExternalAssignees: e.target.checked })}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-1"
          />
          <div className="flex-1">
            <label htmlFor="allowExternal" className="text-sm text-slate-900 cursor-pointer">
              Allow External Assignees
            </label>
            <p className="text-xs text-slate-500 mt-1">
              Enable assignment to external parties (e.g., providers, vendors, third-party
              consultants)
            </p>
          </div>
        </div>

        {/* Reminder Configuration */}
        <div>
          <label className="block text-sm text-slate-700 mb-3">Reminder Configuration</label>
          <div className="space-y-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                id="reminderEnabled"
                checked={config.reminderConfig.enabled}
                onChange={(e) =>
                  updateConfig({
                    reminderConfig: { ...config.reminderConfig, enabled: e.target.checked },
                  })
                }
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 mt-1"
              />
              <div className="flex-1">
                <label htmlFor="reminderEnabled" className="text-sm text-slate-900 cursor-pointer">
                  Enable Automatic Reminders
                </label>
                <p className="text-xs text-slate-500 mt-1">
                  Send periodic reminders to assignees about pending requests
                </p>
              </div>
            </div>

            {config.reminderConfig.enabled && (
              <div className="contents">
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Reminder Interval</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={config.reminderConfig.intervalHours}
                      onChange={(e) =>
                        updateConfig({
                          reminderConfig: {
                            ...config.reminderConfig,
                            intervalHours: parseInt(e.target.value) || 24,
                          },
                        })
                      }
                      className="w-24 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                    <span className="text-sm text-slate-600">hours</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={config.reminderConfig.sendToInternal}
                      onChange={(e) =>
                        updateConfig({
                          reminderConfig: {
                            ...config.reminderConfig,
                            sendToInternal: e.target.checked,
                          },
                        })
                      }
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Send to Internal Team
                  </label>

                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={config.reminderConfig.sendToExternal}
                      onChange={(e) =>
                        updateConfig({
                          reminderConfig: {
                            ...config.reminderConfig,
                            sendToExternal: e.target.checked,
                          },
                        })
                      }
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Send to External Assignees
                  </label>
                </div>
              </div>
            )}
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
              <h4 className="text-sm text-blue-900 mb-1">Assignment Tips</h4>
              <p className="text-xs text-blue-700">
                Setting up default roles ensures requests are properly assigned from the start.
                Round-robin assignment helps distribute workload evenly, while manual assignment
                gives you full control over each request.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}