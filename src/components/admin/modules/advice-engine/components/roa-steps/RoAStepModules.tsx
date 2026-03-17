import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Checkbox } from '../../../../../ui/checkbox';
import { Badge } from '../../../../../ui/badge';
import { RoADraft } from '../DraftRoAInterface';
import { getAllModules } from '../../roaModuleSchemas';
import { 
  Heart, 
  Shield, 
  Banknote, 
  TrendingUp, 
  FileText, 
  Briefcase,
  Activity,
  CheckCircle
} from 'lucide-react';

interface RoAStepModulesProps {
  draft: RoADraft | null;
  onUpdate: (updates: Partial<RoADraft>) => void;
}

// Map module icons
const moduleIcons: Record<string, React.ReactNode> = {
  medical_aid: <Heart className="h-5 w-5" />,
  life_recosting: <Shield className="h-5 w-5" />,
  severe_illness: <Activity className="h-5 w-5" />,
  income_protection: <Banknote className="h-5 w-5" />,
  retirement_annuity_section14: <TrendingUp className="h-5 w-5" />,
  investment_offshore_allangray: <Briefcase className="h-5 w-5" />,
  estate_planning_will: <FileText className="h-5 w-5" />
};

// Module categories for better organization
const moduleCategories = {
  'Risk Management': ['medical_aid', 'life_recosting', 'severe_illness', 'income_protection'],
  'Investments & Retirement': ['retirement_annuity_section14', 'investment_offshore_allangray'],
  'Estate Planning': ['estate_planning_will']
};

export function RoAStepModules({ draft, onUpdate }: RoAStepModulesProps) {
  const allModules = getAllModules();
  const selectedModules = draft?.selectedModules || [];

  const handleModuleToggle = (moduleId: string, checked: boolean) => {
    if (!draft) return;

    let updatedModules: string[];
    let updatedModuleData = { ...draft.moduleData };

    if (checked) {
      // Add module
      updatedModules = [...selectedModules, moduleId];
    } else {
      // Remove module and its data
      updatedModules = selectedModules.filter(id => id !== moduleId);
      delete updatedModuleData[moduleId];
    }

    onUpdate({ 
      selectedModules: updatedModules,
      moduleData: updatedModuleData
    });
  };

  const getModuleCompletionStatus = (moduleId: string) => {
    if (!draft?.moduleData[moduleId]) return 'not-started';
    
    const moduleData = draft.moduleData[moduleId];
    const module = allModules.find(m => m.id === moduleId);
    if (!module) return 'not-started';

    const requiredFields = module.fields.filter(f => f.required);
    const completedRequiredFields = requiredFields.filter(f => 
      moduleData[f.key] && moduleData[f.key].toString().trim() !== ''
    );

    if (completedRequiredFields.length === 0) return 'not-started';
    if (completedRequiredFields.length === requiredFields.length) return 'complete';
    return 'in-progress';
  };

  const getCompletionBadge = (moduleId: string) => {
    const status = getModuleCompletionStatus(moduleId);
    
    switch (status) {
      case 'complete':
        return (
          <Badge variant="default" className="bg-green-100 text-green-700 border-green-200">
            <CheckCircle className="h-3 w-3 mr-1" />
            Complete
          </Badge>
        );
      case 'in-progress':
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 border-yellow-200">
            In Progress
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold mb-2">Select Advice Modules</h2>
        <p className="text-muted-foreground">
          Choose the areas of advice that will be included in this Record of Advice. Each module has specific regulatory requirements and disclosures.
        </p>
      </div>

      {/* Selection Summary */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-blue-900">Selected Modules</p>
              <p className="text-sm text-blue-700">
                {selectedModules.length} module{selectedModules.length !== 1 ? 's' : ''} selected
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-blue-700">
                Complete all selected modules to proceed to review
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Module Categories */}
      <div className="space-y-6">
        {Object.entries(moduleCategories).map(([categoryName, moduleIds]) => (
          <div key={categoryName} className="space-y-4">
            <h3 className="font-semibold text-lg border-b pb-2">{categoryName}</h3>
            
            <div className="grid gap-4 md:grid-cols-2">
              {moduleIds.map((moduleId) => {
                const module = allModules.find(m => m.id === moduleId);
                if (!module) return null;

                const isSelected = selectedModules.includes(moduleId);
                const completionStatus = getModuleCompletionStatus(moduleId);

                return (
                  <Card 
                    key={moduleId}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      isSelected ? 'ring-2 ring-primary bg-primary/5' : ''
                    }`}
                    onClick={() => handleModuleToggle(moduleId, !isSelected)}
                  >
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            checked={isSelected}
                            onChange={(checked) => handleModuleToggle(moduleId, checked)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex items-center gap-2">
                            {moduleIcons[moduleId]}
                            <CardTitle className="text-base">{module.title}</CardTitle>
                          </div>
                        </div>
                        {isSelected && getCompletionBadge(moduleId)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">
                        {module.description}
                      </p>
                      
                      {/* Module Details */}
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Required Fields:</span>
                          <span className="font-medium">
                            {module.fields.filter(f => f.required).length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Disclosures:</span>
                          <span className="font-medium">
                            {module.disclosures.length}
                          </span>
                        </div>
                      </div>

                      {/* Progress indicator for selected modules */}
                      {isSelected && (
                        <div className="mt-3 pt-3 border-t">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Completion</span>
                            <span className="font-medium">
                              {(() => {
                                const requiredFields = module.fields.filter(f => f.required).length;
                                const moduleData = draft?.moduleData[moduleId] || {};
                                const completedFields = module.fields.filter(f => 
                                  f.required && moduleData[f.key] && moduleData[f.key].toString().trim() !== ''
                                ).length;
                                const percentage = requiredFields > 0 ? Math.round((completedFields / requiredFields) * 100) : 0;
                                return `${percentage}%`;
                              })()}
                            </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div 
                              className="bg-primary h-1.5 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${(() => {
                                  const requiredFields = module.fields.filter(f => f.required).length;
                                  const moduleData = draft?.moduleData[moduleId] || {};
                                  const completedFields = module.fields.filter(f => 
                                    f.required && moduleData[f.key] && moduleData[f.key].toString().trim() !== ''
                                  ).length;
                                  return requiredFields > 0 ? Math.round((completedFields / requiredFields) * 100) : 0;
                                })()}%`
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Validation Message */}
      {selectedModules.length === 0 && (
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4">
            <p className="text-orange-700 text-sm">
              Please select at least one module to proceed. Each module represents a specific area of financial advice that will be documented in your Record of Advice.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
