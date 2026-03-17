import React, { useState } from 'react';
import { Plus, Trash2, Edit2, ArrowRight, GripVertical, Clock, Bell } from 'lucide-react';
import { RequestTemplate, LifecycleStage, LifecycleStageRequirement } from '../../../types';

interface Step5LifecycleProps {
  templateData: Partial<RequestTemplate>;
  updateTemplateData: (updates: Partial<RequestTemplate>) => void;
}

export function Step5Lifecycle({ templateData, updateTemplateData }: Step5LifecycleProps) {
  const [editingStage, setEditingStage] = useState<LifecycleStage | null>(null);

  const config = templateData.lifecycleConfiguration || { stages: [] };

  const updateConfig = (updates: Partial<typeof config>) => {
    updateTemplateData({
      lifecycleConfiguration: { ...config, ...updates },
    });
  };

  const addStage = () => {
    const newStage: LifecycleStage = {
      id: `stage_${Date.now()}`,
      name: 'New Stage',
      description: '',
      order: config.stages.length,
      requirements: [],
      allowedTransitions: [],
      reminderSchedule: {
        enabled: false,
        intervalHours: 48,
        sendToInternal: true,
        sendToExternal: false,
      },
    };

    setEditingStage(newStage);
  };

  const saveStage = (stage: LifecycleStage) => {
    const existingIndex = config.stages.findIndex((s) => s.id === stage.id);

    if (existingIndex >= 0) {
      // Update existing
      const newStages = [...config.stages];
      newStages[existingIndex] = stage;
      updateConfig({ stages: newStages });
    } else {
      // Add new
      updateConfig({ stages: [...config.stages, stage] });
    }

    setEditingStage(null);
  };

  const deleteStage = (id: string) => {
    if (!confirm('Are you sure you want to delete this stage?')) return;

    updateConfig({
      stages: config.stages.filter((s) => s.id !== id),
    });
  };

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h3 className="text-lg text-slate-900 mb-2">Lifecycle Builder</h3>
        <p className="text-sm text-slate-600">
          Define the stages a request will go through from start to finish. Configure requirements,
          transitions, SLAs, and reminders for each stage.
        </p>
      </div>

      {/* Stages List */}
      <div className="space-y-4 mb-6">
        {config.stages.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
            <p className="text-slate-600 mb-4">No lifecycle stages defined yet.</p>
            <button
              onClick={addStage}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Add First Stage
            </button>
          </div>
        ) : (
          <div className="contents">
            {/* Stage Flow Visualization */}
            <div className="flex items-center gap-2 overflow-x-auto pb-4">
              {config.stages.map((stage, index) => (
                <div className="contents" key={stage.id}>
                  <div className="flex-shrink-0 bg-white border-2 border-indigo-200 rounded-lg p-3 min-w-[180px]">
                    <div className="text-sm text-slate-900 truncate">{stage.name}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {stage.requirements.length} requirement{stage.requirements.length !== 1 ? 's' : ''}
                    </div>
                    {stage.sla && (
                      <div className="flex items-center gap-1 text-xs text-amber-600 mt-1">
                        <Clock className="w-3 h-3" />
                        {stage.sla.durationHours}h SLA
                      </div>
                    )}
                  </div>
                  {index < config.stages.length - 1 && (
                    <ArrowRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
                  )}
                </div>
              ))}
            </div>

            {/* Detailed Stage Cards */}
            {config.stages.map((stage) => (
              <div
                key={stage.id}
                className="border border-slate-200 rounded-lg bg-white overflow-hidden"
              >
                <div className="flex items-center gap-3 p-4 bg-slate-50">
                  <GripVertical className="w-4 h-4 text-slate-400 cursor-move" />
                  <div className="flex-1">
                    <div className="text-sm text-slate-900">{stage.name}</div>
                    <div className="text-xs text-slate-500">{stage.description}</div>
                  </div>
                  <button
                    onClick={() => setEditingStage(stage)}
                    className="p-2 hover:bg-slate-200 rounded transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-slate-600" />
                  </button>
                  <button
                    onClick={() => deleteStage(stage.id)}
                    className="p-2 hover:bg-red-50 rounded transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  {/* Requirements */}
                  {stage.requirements.length > 0 && (
                    <div>
                      <div className="text-xs text-slate-600 mb-2">Requirements:</div>
                      <div className="space-y-1">
                        {stage.requirements.map((req, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-xs text-slate-700">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                            {req.description}
                            {req.type === 'document' && (
                              <span className="text-slate-500">(Document)</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* SLA */}
                  {stage.sla && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Clock className="w-3 h-3 text-amber-600" />
                      SLA: {stage.sla.durationHours} hours
                      {stage.sla.escalationEnabled && ' (with escalation)'}
                    </div>
                  )}

                  {/* Reminders */}
                  {stage.reminderSchedule.enabled && (
                    <div className="flex items-center gap-2 text-xs text-slate-600">
                      <Bell className="w-3 h-3 text-blue-600" />
                      Reminders every {stage.reminderSchedule.intervalHours} hours
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Stage Button */}
      {config.stages.length > 0 && (
        <button
          onClick={addStage}
          className="w-full py-3 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:border-slate-400 hover:text-slate-700 transition-colors"
        >
          <Plus className="w-4 h-4 inline mr-2" />
          Add Stage
        </button>
      )}

      {/* Stage Editor Modal */}
      {editingStage && (
        <StageEditor
          stage={editingStage}
          allStages={config.stages}
          onSave={saveStage}
          onCancel={() => setEditingStage(null)}
        />
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6">
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
            <h4 className="text-sm text-blue-900 mb-1">Lifecycle Best Practices</h4>
            <ul className="text-xs text-blue-700 space-y-1">
              <li>• Keep stages simple and focused on clear milestones</li>
              <li>• Set realistic SLAs based on typical completion times</li>
              <li>• Use requirements to ensure quality gates are met before progression</li>
              <li>• Configure reminders for stages that commonly experience delays</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stage Editor Component
interface StageEditorProps {
  stage: LifecycleStage;
  allStages: LifecycleStage[];
  onSave: (stage: LifecycleStage) => void;
  onCancel: () => void;
}

function StageEditor({ stage, allStages, onSave, onCancel }: StageEditorProps) {
  const [formData, setFormData] = useState<LifecycleStage>(stage);

  const addRequirement = () => {
    const newReq: LifecycleStageRequirement = {
      type: 'document',
      description: '',
    };

    setFormData({
      ...formData,
      requirements: [...formData.requirements, newReq],
    });
  };

  const updateRequirement = (index: number, updates: Partial<LifecycleStageRequirement>) => {
    const newReqs = [...formData.requirements];
    newReqs[index] = { ...newReqs[index], ...updates };
    setFormData({ ...formData, requirements: newReqs });
  };

  const deleteRequirement = (index: number) => {
    setFormData({
      ...formData,
      requirements: formData.requirements.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg text-slate-900">
            {stage.name === 'New Stage' ? 'Add Stage' : 'Edit Stage'}
          </h3>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-slate-700 mb-1">
                Stage Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g., Document Collection, Review, Approval"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                rows={2}
                placeholder="What happens in this stage?"
              />
            </div>
          </div>

          {/* Requirements */}
          <div>
            <label className="block text-sm text-slate-700 mb-2">
              Stage Requirements (Optional)
            </label>
            <p className="text-xs text-slate-500 mb-3">
              Define what must be completed before moving to the next stage
            </p>

            <div className="space-y-2 mb-3">
              {formData.requirements.map((req, index) => (
                <div key={index} className="flex items-start gap-2 p-3 bg-slate-50 rounded-lg">
                  <select
                    value={req.type}
                    onChange={(e) =>
                      updateRequirement(index, { type: e.target.value as 'document' | 'approval' | 'action' | 'notification' })
                    }
                    className="px-2 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="document">Document</option>
                    <option value="approval">Approval</option>
                    <option value="action">Action</option>
                    <option value="notification">Notification</option>
                  </select>

                  <input
                    type="text"
                    value={req.description}
                    onChange={(e) => updateRequirement(index, { description: e.target.value })}
                    placeholder="Requirement description..."
                    className="flex-1 px-3 py-1 border border-slate-200 rounded text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />

                  <button
                    type="button"
                    onClick={() => deleteRequirement(index)}
                    className="p-1 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addRequirement}
              className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-600 hover:border-slate-400"
            >
              <Plus className="w-4 h-4 inline mr-2" />
              Add Requirement
            </button>
          </div>

          {/* SLA Configuration */}
          <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="slaEnabled"
                checked={!!formData.sla}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sla: e.target.checked
                      ? {
                          durationHours: 48,
                          escalationEnabled: false,
                        }
                      : undefined,
                  })
                }
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="slaEnabled" className="text-sm text-slate-900">
                Enable SLA (Service Level Agreement)
              </label>
            </div>

            {formData.sla && (
              <div className="space-y-3 ml-6">
                <div>
                  <label className="block text-xs text-slate-700 mb-1">Duration (hours)</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.sla.durationHours}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sla: {
                          ...formData.sla!,
                          durationHours: parseInt(e.target.value) || 24,
                        },
                      })
                    }
                    className="w-32 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={formData.sla.escalationEnabled}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        sla: { ...formData.sla!, escalationEnabled: e.target.checked },
                      })
                    }
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  Enable Escalation
                </label>
              </div>
            )}
          </div>

          {/* Reminder Schedule */}
          <div className="space-y-3 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="reminderEnabled"
                checked={formData.reminderSchedule.enabled}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    reminderSchedule: { ...formData.reminderSchedule, enabled: e.target.checked },
                  })
                }
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="reminderEnabled" className="text-sm text-slate-900">
                Enable Stage Reminders
              </label>
            </div>

            {formData.reminderSchedule.enabled && (
              <div className="space-y-3 ml-6">
                <div>
                  <label className="block text-xs text-slate-700 mb-1">
                    Reminder Interval (hours)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formData.reminderSchedule.intervalHours}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        reminderSchedule: {
                          ...formData.reminderSchedule,
                          intervalHours: parseInt(e.target.value) || 24,
                        },
                      })
                    }
                    className="w-32 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.reminderSchedule.sendToInternal}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reminderSchedule: {
                            ...formData.reminderSchedule,
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
                      checked={formData.reminderSchedule.sendToExternal}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          reminderSchedule: {
                            ...formData.reminderSchedule,
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
        </form>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Save Stage
          </button>
        </div>
      </div>
    </div>
  );
}