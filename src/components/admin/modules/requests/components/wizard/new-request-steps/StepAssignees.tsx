import React, { useState } from 'react';
import { Search, User, X, AlertCircle, UserPlus } from 'lucide-react';
import { Input } from '../../../../../../ui/input';
import { Button } from '../../../../../../ui/button';
import { Checkbox } from '../../../../../../ui/checkbox';
import { RequestTemplate, AssignmentRule } from '../../../types';
import { usePersonnel } from '../../../../personnel/hooks/usePersonnel';

interface StepAssigneesProps {
  template: RequestTemplate;
  assignees: string[];
  onUpdateAssignees: (assignees: string[]) => void;
}

export function StepAssignees({ template, assignees, onUpdateAssignees }: StepAssigneesProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);

  // Fetch real personnel data from backend (replaces inline mockUsers)
  const { data: personnelData = [], isLoading: personnelLoading } = usePersonnel();
  const users = personnelData.map(p => ({
    id: p.id,
    name: p.name,
    role: p.role || 'Staff',
    email: p.email,
  }));

  const config = template.assigneeConfiguration;

  // Filter users based on search
  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedUsers = users.filter(u => assignees.includes(u.id));
  const availableUsers = users.filter(u => !assignees.includes(u.id));

  const handleAddAssignee = (userId: string) => {
    if (!assignees.includes(userId)) {
      onUpdateAssignees([...assignees, userId]);
    }
    setSearchQuery('');
    setShowUserSearch(false);
  };

  const handleRemoveAssignee = (userId: string) => {
    onUpdateAssignees(assignees.filter(id => id !== userId));
  };

  const getAssignmentRuleDescription = () => {
    switch (config.assignmentRule) {
      case AssignmentRule.AUTO_ASSIGN_OWNER:
        return 'The template owner will be automatically assigned to this request.';
      case AssignmentRule.AUTO_ASSIGN_ROUND_ROBIN:
        return 'Assignees will be automatically selected using round-robin distribution.';
      case AssignmentRule.MANUAL_REQUIRED:
        return 'You must manually select assignees before creating this request.';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium mb-1">Assign Team Members</h3>
        <p className="text-sm text-muted-foreground">
          Select who will be responsible for managing this request.
        </p>
      </div>

      {/* Assignment Rule Info */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-slate-700 mb-1">Assignment Rule</h4>
            <p className="text-sm text-slate-600">{getAssignmentRuleDescription()}</p>
          </div>
        </div>
      </div>

      {/* Required Roles */}
      {config.defaultRoles.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-3">Required Roles</h4>
          <div className="space-y-2">
            {config.defaultRoles.map((roleConfig, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-medium text-sm text-slate-900">{roleConfig.role}</div>
                    <div className="text-xs text-slate-500">
                      {roleConfig.required ? 'Required' : 'Optional'}
                    </div>
                  </div>
                </div>
                {roleConfig.required && (
                  <span className="text-xs bg-orange-100 text-orange-700 px-2 py-1 rounded">
                    Required
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selected Assignees */}
      {selectedUsers.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-slate-700 mb-3">
            Selected Assignees ({selectedUsers.length})
          </h4>
          <div className="space-y-2">
            {selectedUsers.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center">
                    <User className="h-4 w-4 text-green-700" />
                  </div>
                  <div>
                    <div className="font-medium text-sm text-green-900">{user.name}</div>
                    <div className="text-xs text-green-700">{user.role} • {user.email}</div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRemoveAssignee(user.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Assignees */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-700">
          Add Assignees {config.assignmentRule === AssignmentRule.MANUAL_REQUIRED && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by name, role, or email..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowUserSearch(true);
            }}
            onFocus={() => setShowUserSearch(true)}
            className="pl-9"
          />
        </div>

        {/* User Search Results */}
        {showUserSearch && searchQuery && (
          <div className="border border-slate-200 rounded-lg bg-white shadow-lg max-h-64 overflow-y-auto">
            {filteredUsers.filter(u => !assignees.includes(u.id)).length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-sm">
                No users found
              </div>
            ) : (
              filteredUsers
                .filter(u => !assignees.includes(u.id))
                .map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleAddAssignee(user.id)}
                    className="w-full text-left p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                        <User className="h-4 w-4 text-slate-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h5 className="font-medium text-slate-900 text-sm">{user.name}</h5>
                        <p className="text-xs text-slate-500">
                          {user.role} • {user.email}
                        </p>
                      </div>
                      <UserPlus className="h-4 w-4 text-slate-400" />
                    </div>
                  </button>
                ))
            )}
          </div>
        )}
      </div>

      {/* External Assignees Option */}
      {config.allowExternalAssignees && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-800">
                This template allows external assignees. You can add external participants after creating the request.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reminder Configuration Display */}
      {config.reminderConfig.enabled && (
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="text-sm text-purple-800">
            <strong>Reminders enabled:</strong> Assignees will receive reminders every {config.reminderConfig.intervalHours} hours
            {config.reminderConfig.sendToInternal && ' (internal)'}
            {config.reminderConfig.sendToExternal && ' (external)'}.
          </div>
        </div>
      )}

      {assignees.length === 0 && config.assignmentRule === AssignmentRule.MANUAL_REQUIRED && (
        <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-orange-800">
              You must select at least one assignee to proceed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}