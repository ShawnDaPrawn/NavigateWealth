import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Checkbox } from '../../../../../ui/checkbox';
import { Badge } from '../../../../../ui/badge';
import { Input } from '../../../../../ui/input';
import { Label } from '../../../../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../ui/select';
import { RoADraft, RoAModule } from '../DraftRoAInterface';
import { getFallbackRuntimeModules, getModuleRuntimeStatus } from '../../roaModuleRuntime';
import { 
  Heart, 
  Shield, 
  Banknote, 
  TrendingUp, 
  FileText, 
  Briefcase,
  Activity,
  CheckCircle,
  GitCompare,
  ArrowLeftRight,
  PiggyBank,
  LayoutGrid,
  Search,
  Star,
} from 'lucide-react';

interface RoAStepModulesProps {
  draft: RoADraft | null;
  onUpdate: (updates: Partial<RoADraft>) => void;
  modules?: RoAModule[];
}

// Map module icons
const moduleIcons: Record<string, React.ReactNode> = {
  medical_aid: <Heart className="h-5 w-5" />,
  life_recosting: <Shield className="h-5 w-5" />,
  severe_illness: <Activity className="h-5 w-5" />,
  income_protection: <Banknote className="h-5 w-5" />,
  retirement_annuity_section14: <TrendingUp className="h-5 w-5" />,
  investment_offshore_allangray: <Briefcase className="h-5 w-5" />,
  estate_planning_will: <FileText className="h-5 w-5" />,
  new_life_assurance_proposal: <Shield className="h-5 w-5" />,
  life_insurance_comparison: <GitCompare className="h-5 w-5" />,
  new_investment_proposal: <Briefcase className="h-5 w-5" />,
  investment_replacement_proposal: <ArrowLeftRight className="h-5 w-5" />,
  new_retirement_proposal: <PiggyBank className="h-5 w-5" />,
  section_14_transfer_proposal: <ArrowLeftRight className="h-5 w-5" />,
};

function getModuleIcon(moduleId: string): React.ReactNode {
  return moduleIcons[moduleId] || <LayoutGrid className="h-5 w-5 text-muted-foreground" />;
}

function isFlagshipModule(module: RoAModule): boolean {
  const flag = module.metadata && (module.metadata as { flagshipModule?: unknown }).flagshipModule;
  return flag === true || flag === 'true';
}

export function RoAStepModules({ draft, onUpdate, modules }: RoAStepModulesProps) {
  const allModules = modules && modules.length > 0 ? modules : getFallbackRuntimeModules();
  const selectedModules = draft?.selectedModules || [];
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const categoryNames = useMemo(() => {
    const set = new Set<string>();
    allModules.forEach((m) => set.add(m.category || 'Other'));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allModules]);

  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allModules
      .filter((m) => (categoryFilter === 'all' ? true : (m.category || 'Other') === categoryFilter))
      .filter((m) => {
        if (!q) return true;
        return (
          m.id.toLowerCase().includes(q) ||
          m.title.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q) ||
          (m.category || '').toLowerCase().includes(q)
        );
      })
      .slice()
      .sort((a, b) => {
        const fa = isFlagshipModule(a) ? 0 : 1;
        const fb = isFlagshipModule(b) ? 0 : 1;
        if (fa !== fb) return fa - fb;
        return a.title.localeCompare(b.title);
      });
  }, [allModules, search, categoryFilter]);

  const moduleCategories = filteredModules.reduce<Record<string, string[]>>((categories, module) => {
    const category = module.category || 'Other';
    categories[category] = [...(categories[category] || []), module.id];
    return categories;
  }, {});

  const handleModuleToggle = (moduleId: string, checked: boolean) => {
    if (!draft) return;

    let updatedModules: string[];
    let updatedModuleData = { ...draft.moduleData };
    let updatedModuleEvidence = { ...(draft.moduleEvidence || {}) };
    let updatedModuleOutputs = { ...(draft.moduleOutputs || {}) };

    if (checked) {
      // Add module
      updatedModules = [...selectedModules, moduleId];
    } else {
      // Remove module and its data
      updatedModules = selectedModules.filter(id => id !== moduleId);
      delete updatedModuleData[moduleId];
      delete updatedModuleEvidence[moduleId];
      delete updatedModuleOutputs[moduleId];
    }

    onUpdate({ 
      selectedModules: updatedModules,
      moduleData: updatedModuleData,
      moduleEvidence: updatedModuleEvidence,
      moduleOutputs: updatedModuleOutputs,
    });
  };

  const getModuleCompletionStatus = (moduleId: string) => {
    if (!draft?.moduleData[moduleId]) return 'not-started';
    
    const moduleData = draft.moduleData[moduleId];
    const module = allModules.find(m => m.id === moduleId);
    if (!module) return 'not-started';

    const runtimeStatus = getModuleRuntimeStatus(module, moduleData, draft.moduleEvidence?.[moduleId] || {});

    if (runtimeStatus.percentage === 0) return 'not-started';
    if (runtimeStatus.complete) return 'complete';
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
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-blue-900">Selected Modules</p>
              <p className="text-sm text-blue-700">
                {selectedModules.length} module{selectedModules.length !== 1 ? 's' : ''} selected · {filteredModules.length} shown in library
              </p>
            </div>
            <p className="text-sm text-blue-700 sm:text-right">
              Complete all selected modules to proceed to review
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="flex-1 space-y-2">
          <Label htmlFor="roa-module-search" className="text-sm font-medium">
            Search modules
          </Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="roa-module-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Title, category, or contract id…"
              className="pl-9"
            />
          </div>
        </div>
        <div className="w-full space-y-2 md:w-56">
          <Label className="text-sm font-medium">Category</Label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categoryNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Module Categories */}
      <div className="space-y-6">
        {filteredModules.length === 0 && (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No modules match your filters. Clear search or choose &quot;All categories&quot;.
            </CardContent>
          </Card>
        )}
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
                            onCheckedChange={(checked) => handleModuleToggle(moduleId, checked === true)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            {getModuleIcon(moduleId)}
                            <CardTitle className="text-base">{module.title}</CardTitle>
                            {isFlagshipModule(module) && (
                              <Badge variant="secondary" className="gap-1 border-amber-200 bg-amber-50 text-amber-900">
                                <Star className="h-3 w-3" />
                                Flagship
                              </Badge>
                            )}
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
                        {(module.contractVersion !== undefined || module.schemaVersion) && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Contract:</span>
                            <span className="font-mono font-medium text-[11px]">
                              {module.contractVersion !== undefined ? `v${module.contractVersion}` : '—'}
                              {module.schemaVersion ? ` · ${module.schemaVersion}` : ''}
                            </span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Required fields:</span>
                          <span className="font-medium">
                            {module.fields.filter(f => f.required).length}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Evidence slots:</span>
                          <span className="font-medium">
                            {module.evidence?.requirements.filter((r) => r.required).length ?? 0}
                            {module.evidence?.requirements.length
                              ? ` / ${module.evidence.requirements.length}`
                              : ''}
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
                                const moduleData = draft?.moduleData[moduleId] || {};
                                const status = getModuleRuntimeStatus(module, moduleData, draft?.moduleEvidence?.[moduleId] || {});
                                return `${status.percentage}%`;
                              })()}
                          </span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div 
                              className="bg-primary h-1.5 rounded-full transition-all duration-300"
                              style={{ 
                                width: `${(() => {
                                  const moduleData = draft?.moduleData[moduleId] || {};
                                  return getModuleRuntimeStatus(module, moduleData, draft?.moduleEvidence?.[moduleId] || {}).percentage;
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
