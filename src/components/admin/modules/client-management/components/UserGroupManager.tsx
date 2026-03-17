import React, { useState, useEffect } from 'react';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Textarea } from '../../../../ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../../../ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Plus, Edit, Trash2, Settings, UserCheck, Check } from 'lucide-react';
// Cross-module dependency: client-management → communication (public API surface)
// Justified: UserGroupManager manages communication groups from the client management context.
import { communicationApi } from '../../communication/api';
import { ClientGroup } from '../../communication/types';
import { toast } from 'sonner@2.0.3';

interface UserGroupManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserGroupManager({ open, onOpenChange }: UserGroupManagerProps) {
  const [groups, setGroups] = useState<ClientGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<{
    id?: string;
    name: string;
    color: string;
    description: string;
  }>({
    name: '',
    color: '#6d28d9',
    description: ''
  });

  useEffect(() => {
    if (open) {
      fetchGroups();
    }
  }, [open]);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      // Fetch enough groups to show in the list
      const fetchedGroups = await communicationApi.getGroups(1, 100);
      setGroups(fetchedGroups);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
      toast.error('Failed to load user groups');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGroup = async () => {
    if (!formData.name.trim()) {
      toast.error('Group name is required');
      return;
    }

    try {
      if (formData.id) {
        // Update existing
        await communicationApi.updateGroup(formData.id, {
          name: formData.name,
          color: formData.color,
          description: formData.description
        });
        toast.success('Group updated successfully');
      } else {
        // Create new
        await communicationApi.createGroup({
          name: formData.name,
          color: formData.color,
          description: formData.description,
          clientIds: [], // Default empty
        });
        toast.success('Group created successfully');
      }
      
      // Reset form and refresh list
      setFormData({ name: '', color: '#6d28d9', description: '' });
      fetchGroups();
    } catch (error) {
      console.error('Error saving group:', error);
      toast.error('Failed to save group');
    }
  };

  const handleEditClick = (group: ClientGroup) => {
    setFormData({
      id: group.id,
      name: group.name,
      color: group.color || '#6d28d9', // Fallback color
      description: group.description
    });
  };

  const handleDeleteClick = async (id: string) => {
    if (!confirm('Are you sure you want to delete this group?')) return;
    
    try {
      await communicationApi.deleteGroup(id);
      toast.success('Group deleted');
      fetchGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast.error('Failed to delete group');
    }
  };

  const handleCancelEdit = () => {
    setFormData({ name: '', color: '#6d28d9', description: '' });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Manage User Groups
          </DialogTitle>
          <DialogDescription>
            Define and manage different user group types for client categorization and filtering
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Create / Edit Group */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {formData.id ? 'Edit User Group' : 'Create New User Group'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Group Name</Label>
                  <Input 
                    placeholder="e.g., High Net Worth Individuals" 
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>
                <div>
                  <Label>Group Color</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="color" 
                      value={formData.color}
                      onChange={(e) => setFormData({...formData, color: e.target.value})}
                      className="w-16 h-10 p-1 cursor-pointer" 
                    />
                    <Input 
                      placeholder="#6d28d9" 
                      value={formData.color}
                      onChange={(e) => setFormData({...formData, color: e.target.value})}
                      className="flex-1" 
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label>Criteria</Label>
                <Textarea 
                  placeholder="Define the criteria for this user group (e.g., Assets > R10M, Age 25-35, etc.)"
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={handleSaveGroup} 
                  className={formData.id ? "bg-blue-600 hover:bg-blue-700" : "bg-purple-600 hover:bg-purple-700"}
                >
                  {formData.id ? <Check className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                  {formData.id ? 'Update Group' : 'Add Group'}
                </Button>
                {formData.id && (
                  <Button variant="ghost" onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Existing Groups */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Existing User Groups</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {loading ? (
                  <div className="text-center py-4 text-muted-foreground">Loading groups...</div>
                ) : groups.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">No groups found. Create one above.</div>
                ) : (
                  groups.map((group) => (
                    <div key={group.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-4 h-4 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: group.color || '#ccc' }}
                        />
                        <div>
                          <div className="font-medium">{group.name}</div>
                          <div className="text-sm text-muted-foreground">{group.description || 'No criteria defined'}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={() => handleEditClick(group)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteClick(group.id)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bulk Group Assignment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Bulk Group Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Select User Group</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a user group" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: group.color || '#ccc' }}
                            />
                            {group.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Assignment Method</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose assignment method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manual">Manual Selection</SelectItem>
                      <SelectItem value="criteria">Auto-assign by Criteria</SelectItem>
                      <SelectItem value="import">Import from CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button variant="outline" onClick={() => toast.info("Bulk assignment feature coming soon")}>
                <UserCheck className="h-4 w-4 mr-2" />
                Assign Groups
              </Button>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}