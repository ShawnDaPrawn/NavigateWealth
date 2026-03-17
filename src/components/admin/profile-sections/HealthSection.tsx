import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { Button } from '../../ui/button';
import { Separator } from '../../ui/separator';
import { Switch } from '../../ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../ui/alert-dialog';
import { Heart, Plus, Edit2, Trash2, X, Check, Pill } from 'lucide-react';
import { EmptyState } from '../../pages/profile/EmptyState';
import { emptyStateConfigs } from '../../pages/profile/emptyStateConfigs';

interface ChronicCondition {
  id: string;
  conditionName: string;
  monthDiagnosed: string;
  yearDiagnosed: string;
  onTreatment: boolean;
  treatingDoctor: string;
}

interface HealthSectionProps {
  profileData: Record<string, unknown>;
  chronicConditionsInEditMode: Set<string>;
  chronicConditionToDelete: string | null;
  handleInputChange: (field: string, value: string | number | boolean) => void;
  addChronicCondition: () => void;
  editChronicCondition: (id: string) => void;
  saveChronicCondition: (id: string) => void;
  cancelEditChronicCondition: (id: string) => void;
  confirmDeleteChronicCondition: (id: string) => void;
  removeChronicCondition: () => void;
  updateChronicCondition: (id: string, updates: Partial<ChronicCondition>) => void;
  setChronicConditionToDelete: (value: string | null) => void;
}

export function HealthSection({
  profileData,
  chronicConditionsInEditMode,
  chronicConditionToDelete,
  handleInputChange,
  addChronicCondition,
  editChronicCondition,
  saveChronicCondition,
  cancelEditChronicCondition,
  confirmDeleteChronicCondition,
  removeChronicCondition,
  updateChronicCondition,
  setChronicConditionToDelete
}: HealthSectionProps) {
  return (
    <div className="contents">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-[#6d28d9]/10 flex items-center justify-center">
              <Heart className="h-5 w-5 text-[#6d28d9]" />
            </div>
            <div>
              <CardTitle>Health Information</CardTitle>
              <CardDescription>Client's health and wellness details</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="height">Height</Label>
              <Input
                id="height"
                type="number"
                value={profileData.height || ''}
                onChange={(e) => handleInputChange('height', parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="heightUnit">Unit</Label>
              <Select
                value={profileData.heightUnit}
                onValueChange={(value: 'cm' | 'ft') => handleInputChange('heightUnit', value)}
              >
                <SelectTrigger id="heightUnit" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cm">cm</SelectItem>
                  <SelectItem value="ft">ft</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="weight">Weight</Label>
              <Input
                id="weight"
                type="number"
                value={profileData.weight || ''}
                onChange={(e) => handleInputChange('weight', parseFloat(e.target.value) || 0)}
                placeholder="0"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label htmlFor="weightUnit">Unit</Label>
              <Select
                value={profileData.weightUnit}
                onValueChange={(value: 'kg' | 'lbs') => handleInputChange('weightUnit', value)}
              >
                <SelectTrigger id="weightUnit" className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="lbs">lbs</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-2">
              <Label htmlFor="bloodType">Blood Type</Label>
              <Select
                value={profileData.bloodType}
                onValueChange={(value) => handleInputChange('bloodType', value)}
              >
                <SelectTrigger id="bloodType" className="mt-1.5">
                  <SelectValue placeholder="Select blood type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A+">A+</SelectItem>
                  <SelectItem value="A-">A-</SelectItem>
                  <SelectItem value="B+">B+</SelectItem>
                  <SelectItem value="B-">B-</SelectItem>
                  <SelectItem value="AB+">AB+</SelectItem>
                  <SelectItem value="AB-">AB-</SelectItem>
                  <SelectItem value="O+">O+</SelectItem>
                  <SelectItem value="O-">O-</SelectItem>
                  <SelectItem value="Unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm text-gray-900">Smoker</h4>
                <p className="text-xs text-gray-500">Does the client currently smoke?</p>
              </div>
              <Switch
                checked={profileData.smokerStatus}
                onCheckedChange={(checked) => handleInputChange('smokerStatus', checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm text-gray-900">Health Conditions</h4>
                <p className="text-xs text-gray-500">Does the client have any health conditions?</p>
              </div>
              <Switch
                checked={profileData.hasChronicConditions}
                onCheckedChange={(checked) => handleInputChange('hasChronicConditions', checked)}
              />
            </div>
          </div>

          {profileData.hasChronicConditions && (
            <div className="contents">
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm text-gray-900">Manage Health Conditions</h4>
                    <p className="text-xs text-gray-500">Details about health conditions</p>
                  </div>
                  <Button
                    onClick={addChronicCondition}
                    size="sm"
                    disabled={chronicConditionsInEditMode.size > 0}
                    className="bg-[#6d28d9] hover:bg-[#5b21b6] disabled:opacity-50 disabled:cursor-not-allowed"
                    title={chronicConditionsInEditMode.size > 0 ? "Please save the current condition before adding a new one" : "Add a new health condition"}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Condition
                  </Button>
                </div>

                {profileData.chronicConditions.length === 0 ? (
                  <EmptyState
                    icon={emptyStateConfigs.chronicConditions.icon}
                    title={emptyStateConfigs.chronicConditions.title}
                    description={emptyStateConfigs.chronicConditions.description}
                    actionLabel={emptyStateConfigs.chronicConditions.actionLabel}
                    onAction={addChronicCondition}
                    iconColor={emptyStateConfigs.chronicConditions.iconColor}
                    iconBgColor={emptyStateConfigs.chronicConditions.iconBgColor}
                    buttonColor={emptyStateConfigs.chronicConditions.buttonColor}
                    buttonHoverColor={emptyStateConfigs.chronicConditions.buttonHoverColor}
                  />
                ) : (
                  <div className="space-y-4">
                    {profileData.chronicConditions.map((condition: ChronicCondition) => {
                      const isInEditMode = chronicConditionsInEditMode.has(condition.id);
                      const isValid = condition.conditionName;
                      
                      return (
                        <div key={condition.id} className={`p-5 rounded-lg border-2 ${isInEditMode ? 'border-[#6d28d9] bg-white' : 'border-gray-200 bg-white'}`}>
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                <Pill className="h-5 w-5 text-[#6d28d9]" />
                              </div>
                              <div>
                                <h5 className="text-gray-900">{condition.conditionName || 'New Health Condition'}</h5>
                                {condition.monthDiagnosed && condition.yearDiagnosed && !isInEditMode && (
                                  <p className="text-xs text-gray-600">Diagnosed: {condition.monthDiagnosed} {condition.yearDiagnosed}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {!isInEditMode ? (
                                <div className="contents">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => editChronicCondition(condition.id)}
                                    className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9]/10"
                                  >
                                    <Edit2 className="h-4 w-4 mr-1" />
                                    Edit
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => confirmDeleteChronicCondition(condition.id)}
                                    className="border-red-600 text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              ) : (
                                <div className="contents">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => cancelEditChronicCondition(condition.id)}
                                    className="border-gray-300 text-gray-700 hover:bg-gray-50"
                                  >
                                    <X className="h-4 w-4 mr-1" />
                                    Cancel
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => saveChronicCondition(condition.id)}
                                    disabled={!isValid}
                                    className={`${!isValid ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-[#6d28d9] text-white hover:bg-[#5b21b6]'} border-[#6d28d9]`}
                                  >
                                    <Check className="h-4 w-4 mr-1" />
                                    Save
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>

                          {isInEditMode ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div className="sm:col-span-2">
                                <Label htmlFor={`condition-name-${condition.id}`}>Name of Condition *</Label>
                                <Input
                                  id={`condition-name-${condition.id}`}
                                  value={condition.conditionName}
                                  onChange={(e) => updateChronicCondition(condition.id, { conditionName: e.target.value })}
                                  placeholder="e.g., Diabetes, Hypertension"
                                  className="mt-1.5"
                                />
                              </div>

                              <div>
                                <Label htmlFor={`condition-month-${condition.id}`}>Month Diagnosed</Label>
                                <Select
                                  value={condition.monthDiagnosed}
                                  onValueChange={(value) => updateChronicCondition(condition.id, { monthDiagnosed: value })}
                                >
                                  <SelectTrigger id={`condition-month-${condition.id}`} className="mt-1.5">
                                    <SelectValue placeholder="Select month" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="January">January</SelectItem>
                                    <SelectItem value="February">February</SelectItem>
                                    <SelectItem value="March">March</SelectItem>
                                    <SelectItem value="April">April</SelectItem>
                                    <SelectItem value="May">May</SelectItem>
                                    <SelectItem value="June">June</SelectItem>
                                    <SelectItem value="July">July</SelectItem>
                                    <SelectItem value="August">August</SelectItem>
                                    <SelectItem value="September">September</SelectItem>
                                    <SelectItem value="October">October</SelectItem>
                                    <SelectItem value="November">November</SelectItem>
                                    <SelectItem value="December">December</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label htmlFor={`condition-year-${condition.id}`}>Year Diagnosed</Label>
                                <Input
                                  id={`condition-year-${condition.id}`}
                                  type="number"
                                  value={condition.yearDiagnosed}
                                  onChange={(e) => updateChronicCondition(condition.id, { yearDiagnosed: e.target.value })}
                                  placeholder="e.g., 2020"
                                  min="1900"
                                  max={new Date().getFullYear()}
                                  className="mt-1.5"
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <Label htmlFor={`condition-doctor-${condition.id}`}>Treating Doctor</Label>
                                <Input
                                  id={`condition-doctor-${condition.id}`}
                                  value={condition.treatingDoctor}
                                  onChange={(e) => updateChronicCondition(condition.id, { treatingDoctor: e.target.value })}
                                  placeholder="Dr. Name (Optional)"
                                  className="mt-1.5"
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <div className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-gray-50">
                                  <div>
                                    <Label htmlFor={`condition-treatment-${condition.id}`} className="text-sm text-gray-900">
                                      Currently on Treatment?
                                    </Label>
                                    <p className="text-xs text-gray-500">Is the client receiving treatment for this condition?</p>
                                  </div>
                                  <Switch
                                    id={`condition-treatment-${condition.id}`}
                                    checked={condition.onTreatment}
                                    onCheckedChange={(checked) => updateChronicCondition(condition.id, { onTreatment: checked })}
                                  />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                                {condition.treatingDoctor && (
                                  <div>
                                    <p className="text-gray-600 text-[12px]">Treating Doctor</p>
                                    <p className="text-gray-900 text-[12px]">{condition.treatingDoctor}</p>
                                  </div>
                                )}
                                <div>
                                  <p className="text-gray-600">Treatment Status</p>
                                  <p className="text-gray-900 text-[12px]">{condition.onTreatment ? 'Currently on treatment' : 'Not on treatment'}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Health Condition Confirmation Dialog */}
      <AlertDialog open={chronicConditionToDelete !== null} onOpenChange={() => setChronicConditionToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Health Condition</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this health condition? This action cannot be undone and all information about this condition will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setChronicConditionToDelete(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={removeChronicCondition}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}