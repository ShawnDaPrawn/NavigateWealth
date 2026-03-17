import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../../../../../ui/button';
import { Input } from '../../../../../ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../ui/select';
import { Badge } from '../../../../../ui/badge';
import { Separator } from '../../../../../ui/separator';
import { GroupFilterConfig } from '../../types';
import { Provider, PRODUCT_CATEGORIES } from '../../../product-management/types';
import { MARITAL_STATUS_OPTIONS, EMPLOYMENT_STATUS_OPTIONS, GENDER_OPTIONS, COUNTRY_OPTIONS, OCCUPATION_OPTIONS } from './constants';

interface FilterBuilderProps {
  filterConfig: GroupFilterConfig;
  onChange: (config: GroupFilterConfig) => void;
  providers: Provider[];
}

export function FilterBuilder({ filterConfig, onChange, providers }: FilterBuilderProps) {

  // Helper to get categories for a selected provider
  const getCategoriesForProvider = (providerId?: string) => {
    if (!providerId || providerId === 'all') return PRODUCT_CATEGORIES;
    const provider = providers.find(p => p.id === providerId || p.name === providerId); 
    if (!provider) return PRODUCT_CATEGORIES;
    return PRODUCT_CATEGORIES.filter(c => provider.categoryIds.includes(c.id));
  };

  // --- Product Filters ---
  const updateProductFilter = (index: number, field: 'provider' | 'type', value: string) => {
    const newFilters = [...(filterConfig.productFilters || [])];
    if (!newFilters[index]) newFilters[index] = {};
    
    if (value === 'all') delete newFilters[index][field];
    else newFilters[index][field] = value;
    
    if (!newFilters[index].provider && !newFilters[index].type) {
      newFilters.splice(index, 1);
    }
    onChange({ ...filterConfig, productFilters: newFilters });
  };

  const addProductFilter = () => {
    onChange({
      ...filterConfig,
      productFilters: [...(filterConfig.productFilters || []), {}]
    });
  };

  const removeProductFilter = (index: number) => {
    const newFilters = [...(filterConfig.productFilters || [])];
    newFilters.splice(index, 1);
    onChange({ ...filterConfig, productFilters: newFilters });
  };

  // --- Net Worth Filters ---
  const updateNetWorthFilter = (index: number, field: 'min' | 'max', value: string) => {
    const newFilters = [...(filterConfig.netWorthFilters || [])];
    if (!newFilters[index]) newFilters[index] = {};
    
    const numVal = value ? Number(value) : undefined;
    newFilters[index][field] = numVal;

    if (newFilters[index].min === undefined && newFilters[index].max === undefined) {
        newFilters.splice(index, 1);
    }
    onChange({ ...filterConfig, netWorthFilters: newFilters });
  };

  const addNetWorthFilter = () => {
    onChange({
      ...filterConfig,
      netWorthFilters: [...(filterConfig.netWorthFilters || []), {}]
    });
  };

  const removeNetWorthFilter = (index: number) => {
    const newFilters = [...(filterConfig.netWorthFilters || [])];
    newFilters.splice(index, 1);
    onChange({ ...filterConfig, netWorthFilters: newFilters });
  };

  // --- Age Filters ---
  const updateAgeFilter = (index: number, field: 'min' | 'max', value: string) => {
    const newFilters = [...(filterConfig.ageFilters || [])];
    if (!newFilters[index]) newFilters[index] = {};
    
    const numVal = value ? Number(value) : undefined;
    newFilters[index][field] = numVal;

    if (newFilters[index].min === undefined && newFilters[index].max === undefined) {
        newFilters.splice(index, 1);
    }
    onChange({ ...filterConfig, ageFilters: newFilters });
  };

  const addAgeFilter = () => {
    onChange({
      ...filterConfig,
      ageFilters: [...(filterConfig.ageFilters || []), {}]
    });
  };

  const removeAgeFilter = (index: number) => {
    const newFilters = [...(filterConfig.ageFilters || [])];
    newFilters.splice(index, 1);
    onChange({ ...filterConfig, ageFilters: newFilters });
  };

  // --- Income Filters ---
  const updateIncomeFilter = (index: number, field: 'min' | 'max', value: string) => {
    const newFilters = [...(filterConfig.incomeFilters || [])];
    if (!newFilters[index]) newFilters[index] = {};
    
    const numVal = value ? Number(value) : undefined;
    newFilters[index][field] = numVal;

    if (newFilters[index].min === undefined && newFilters[index].max === undefined) {
        newFilters.splice(index, 1);
    }
    onChange({ ...filterConfig, incomeFilters: newFilters });
  };

  const addIncomeFilter = () => {
    onChange({
      ...filterConfig,
      incomeFilters: [...(filterConfig.incomeFilters || []), {}]
    });
  };

  const removeIncomeFilter = (index: number) => {
    const newFilters = [...(filterConfig.incomeFilters || [])];
    newFilters.splice(index, 1);
    onChange({ ...filterConfig, incomeFilters: newFilters });
  };

  // --- Dependant Count Filters ---
  const updateDependantCountFilter = (index: number, field: 'min' | 'max', value: string) => {
    const newFilters = [...(filterConfig.dependantCountFilters || [])];
    if (!newFilters[index]) newFilters[index] = {};
    
    const numVal = value ? Number(value) : undefined;
    newFilters[index][field] = numVal;

    if (newFilters[index].min === undefined && newFilters[index].max === undefined) {
        newFilters.splice(index, 1);
    }
    onChange({ ...filterConfig, dependantCountFilters: newFilters });
  };

  const addDependantCountFilter = () => {
    onChange({
      ...filterConfig,
      dependantCountFilters: [...(filterConfig.dependantCountFilters || []), {}]
    });
  };

  const removeDependantCountFilter = (index: number) => {
    const newFilters = [...(filterConfig.dependantCountFilters || [])];
    newFilters.splice(index, 1);
    onChange({ ...filterConfig, dependantCountFilters: newFilters });
  };

  // --- Retirement Age Filters ---
  const updateRetirementAgeFilter = (index: number, field: 'min' | 'max', value: string) => {
    const newFilters = [...(filterConfig.retirementAgeFilters || [])];
    if (!newFilters[index]) newFilters[index] = {};
    
    const numVal = value ? Number(value) : undefined;
    newFilters[index][field] = numVal;

    if (newFilters[index].min === undefined && newFilters[index].max === undefined) {
        newFilters.splice(index, 1);
    }
    onChange({ ...filterConfig, retirementAgeFilters: newFilters });
  };

  const addRetirementAgeFilter = () => {
    onChange({
      ...filterConfig,
      retirementAgeFilters: [...(filterConfig.retirementAgeFilters || []), {}]
    });
  };

  const removeRetirementAgeFilter = (index: number) => {
    const newFilters = [...(filterConfig.retirementAgeFilters || [])];
    newFilters.splice(index, 1);
    onChange({ ...filterConfig, retirementAgeFilters: newFilters });
  };

  // --- Status Filters ---
  const toggleStatusFilter = (field: 'maritalStatusFilters' | 'employmentStatusFilters' | 'genderFilters' | 'countryFilters' | 'occupationFilters', value: string) => {
      const current = filterConfig[field] || [];
      let updated;
      if (current.includes(value)) {
          updated = current.filter(v => v !== value);
      } else {
          updated = [...current, value];
      }
      onChange({ ...filterConfig, [field]: updated });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Filter Rules</CardTitle>
        <CardDescription>Clients matching these rules will be automatically included.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        
        {/* Product Filters */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Product Requirements</h4>
            <Button variant="outline" size="sm" onClick={addProductFilter}>
              <Plus className="h-3 w-3 mr-1" /> Add Rule
            </Button>
          </div>
          
          {(filterConfig.productFilters || []).length === 0 && (
            <p className="text-sm text-muted-foreground italic bg-muted/10 p-2 rounded border border-dashed">No product filters applied. (Clients with ANY products included)</p>
          )}

          {(filterConfig.productFilters || []).map((filter, index) => (
            <div key={index} className="flex gap-3 items-end p-3 border rounded-md bg-muted/20">
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium">Provider</label>
                <Select 
                  value={filter.provider || 'all'} 
                  onValueChange={(val) => updateProductFilter(index, 'provider', val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any Provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Provider</SelectItem>
                    {providers.map(p => (
                      <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-xs font-medium">Product Type</label>
                <Select 
                  value={filter.type || 'all'} 
                  onValueChange={(val) => updateProductFilter(index, 'type', val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Any Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Any Type</SelectItem>
                    {getCategoriesForProvider(filter.provider).map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeProductFilter(index)} aria-label="Remove product filter">
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <Separator />

        {/* Net Worth Filters */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Net Worth Range (OR Logic)</h4>
            <Button variant="outline" size="sm" onClick={addNetWorthFilter}>
              <Plus className="h-3 w-3 mr-1" /> Add Range
            </Button>
          </div>
          
          {(filterConfig.netWorthFilters || []).length === 0 && (
              <p className="text-sm text-muted-foreground italic bg-muted/10 p-2 rounded border border-dashed">No net worth filters applied.</p>
          )}

          {(filterConfig.netWorthFilters || []).map((filter, index) => (
            <div key={index} className="flex items-center gap-4 p-3 border rounded-md bg-muted/20">
              <div className="flex-1">
                <label className="text-xs font-medium">Min (R)</label>
                <Input 
                  type="number"
                  placeholder="Min Value"
                  value={filter.min ?? ''}
                  onChange={(e) => updateNetWorthFilter(index, 'min', e.target.value)}
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-medium">Max (R)</label>
                <Input 
                  type="number"
                  placeholder="Max Value"
                  value={filter.max ?? ''}
                  onChange={(e) => updateNetWorthFilter(index, 'max', e.target.value)}
                />
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeNetWorthFilter(index)} className="mt-4" aria-label="Remove net worth filter">
                <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <Separator />

        {/* Age Filters */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Age Range (OR Logic)</h4>
              <Button variant="outline" size="sm" onClick={addAgeFilter}>
                  <Plus className="h-3 w-3 mr-1" /> Add Range
              </Button>
          </div>

          {(filterConfig.ageFilters || []).length === 0 && (
              <p className="text-sm text-muted-foreground italic bg-muted/10 p-2 rounded border border-dashed">No age filters applied.</p>
          )}

          {(filterConfig.ageFilters || []).map((filter, index) => (
              <div key={index} className="flex items-center gap-4 p-3 border rounded-md bg-muted/20">
              <div className="flex-1">
                  <label className="text-xs font-medium">Min Age</label>
                  <Input 
                  type="number"
                  value={filter.min ?? ''}
                  onChange={(e) => updateAgeFilter(index, 'min', e.target.value)}
                  />
              </div>
              <div className="flex-1">
                  <label className="text-xs font-medium">Max Age</label>
                  <Input 
                  type="number"
                  value={filter.max ?? ''}
                  onChange={(e) => updateAgeFilter(index, 'max', e.target.value)}
                  />
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeAgeFilter(index)} className="mt-4" aria-label="Remove age filter">
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
              </div>
          ))}
        </div>

        <Separator />

        {/* Additional Demographics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
              <h4 className="text-sm font-medium">Marital Status</h4>
              <div className="flex flex-wrap gap-2">
                  {MARITAL_STATUS_OPTIONS.map(status => (
                      <Badge 
                          key={status}
                          variant={filterConfig.maritalStatusFilters?.includes(status) ? 'default' : 'outline'}
                          className="cursor-pointer hover:bg-primary/90 hover:text-primary-foreground"
                          onClick={() => toggleStatusFilter('maritalStatusFilters', status)}
                      >
                          {status}
                      </Badge>
                  ))}
              </div>
          </div>

          <div className="space-y-3">
              <h4 className="text-sm font-medium">Employment Status</h4>
              <div className="flex flex-wrap gap-2">
                  {EMPLOYMENT_STATUS_OPTIONS.map(status => (
                      <Badge 
                          key={status}
                          variant={filterConfig.employmentStatusFilters?.includes(status) ? 'default' : 'outline'}
                          className="cursor-pointer hover:bg-primary/90 hover:text-primary-foreground"
                          onClick={() => toggleStatusFilter('employmentStatusFilters', status)}
                      >
                          {status}
                      </Badge>
                  ))}
              </div>
          </div>
        </div>

        <Separator />

        {/* Income Range Filters */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Monthly Income Range (OR Logic)</h4>
              <Button variant="outline" size="sm" onClick={addIncomeFilter}>
                  <Plus className="h-3 w-3 mr-1" /> Add Range
              </Button>
          </div>

          {(filterConfig.incomeFilters || []).length === 0 && (
              <p className="text-sm text-muted-foreground italic bg-muted/10 p-2 rounded border border-dashed">No income filters applied.</p>
          )}

          {(filterConfig.incomeFilters || []).map((filter, index) => (
              <div key={index} className="flex items-center gap-4 p-3 border rounded-md bg-muted/20">
              <div className="flex-1">
                  <label className="text-xs font-medium">Min (R)</label>
                  <Input 
                  type="number"
                  placeholder="Min Income"
                  value={filter.min ?? ''}
                  onChange={(e) => updateIncomeFilter(index, 'min', e.target.value)}
                  />
              </div>
              <div className="flex-1">
                  <label className="text-xs font-medium">Max (R)</label>
                  <Input 
                  type="number"
                  placeholder="Max Income"
                  value={filter.max ?? ''}
                  onChange={(e) => updateIncomeFilter(index, 'max', e.target.value)}
                  />
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeIncomeFilter(index)} className="mt-4" aria-label="Remove income filter">
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
              </div>
          ))}
        </div>

        <Separator />

        {/* Gender and Country Filters */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
              <h4 className="text-sm font-medium">Gender</h4>
              <div className="flex flex-wrap gap-2">
                  {GENDER_OPTIONS.map(gender => (
                      <Badge 
                          key={gender}
                          variant={filterConfig.genderFilters?.includes(gender) ? 'default' : 'outline'}
                          className="cursor-pointer hover:bg-primary/90 hover:text-primary-foreground"
                          onClick={() => toggleStatusFilter('genderFilters', gender)}
                      >
                          {gender}
                      </Badge>
                  ))}
              </div>
          </div>

          <div className="space-y-3">
              <h4 className="text-sm font-medium">Country</h4>
              <div className="flex flex-wrap gap-2">
                  {COUNTRY_OPTIONS.map(country => (
                      <Badge 
                          key={country}
                          variant={filterConfig.countryFilters?.includes(country) ? 'default' : 'outline'}
                          className="cursor-pointer hover:bg-primary/90 hover:text-primary-foreground"
                          onClick={() => toggleStatusFilter('countryFilters', country)}
                      >
                          {country}
                      </Badge>
                  ))}
              </div>
          </div>
        </div>

        <Separator />

        {/* Occupation Filter */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Occupation</h4>
          <div className="flex flex-wrap gap-2">
              {OCCUPATION_OPTIONS.map(occupation => (
                  <Badge 
                      key={occupation}
                      variant={filterConfig.occupationFilters?.includes(occupation) ? 'default' : 'outline'}
                      className="cursor-pointer hover:bg-primary/90 hover:text-primary-foreground"
                      onClick={() => toggleStatusFilter('occupationFilters', occupation)}
                  >
                      {occupation}
                  </Badge>
              ))}
          </div>
        </div>

        <Separator />

        {/* Dependant Count Filters */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Number of Dependants (OR Logic)</h4>
              <Button variant="outline" size="sm" onClick={addDependantCountFilter}>
                  <Plus className="h-3 w-3 mr-1" /> Add Range
              </Button>
          </div>

          {(filterConfig.dependantCountFilters || []).length === 0 && (
              <p className="text-sm text-muted-foreground italic bg-muted/10 p-2 rounded border border-dashed">No dependant count filters applied.</p>
          )}

          {(filterConfig.dependantCountFilters || []).map((filter, index) => (
              <div key={index} className="flex items-center gap-4 p-3 border rounded-md bg-muted/20">
              <div className="flex-1">
                  <label className="text-xs font-medium">Min Count</label>
                  <Input 
                  type="number"
                  placeholder="Min"
                  value={filter.min ?? ''}
                  onChange={(e) => updateDependantCountFilter(index, 'min', e.target.value)}
                  />
              </div>
              <div className="flex-1">
                  <label className="text-xs font-medium">Max Count</label>
                  <Input 
                  type="number"
                  placeholder="Max"
                  value={filter.max ?? ''}
                  onChange={(e) => updateDependantCountFilter(index, 'max', e.target.value)}
                  />
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeDependantCountFilter(index)} className="mt-4" aria-label="Remove dependant count filter">
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
              </div>
          ))}
        </div>

        <Separator />

        {/* Retirement Age Filters */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Expected Retirement Age (OR Logic)</h4>
              <Button variant="outline" size="sm" onClick={addRetirementAgeFilter}>
                  <Plus className="h-3 w-3 mr-1" /> Add Range
              </Button>
          </div>

          {(filterConfig.retirementAgeFilters || []).length === 0 && (
              <p className="text-sm text-muted-foreground italic bg-muted/10 p-2 rounded border border-dashed">No retirement age filters applied.</p>
          )}

          {(filterConfig.retirementAgeFilters || []).map((filter, index) => (
              <div key={index} className="flex items-center gap-4 p-3 border rounded-md bg-muted/20">
              <div className="flex-1">
                  <label className="text-xs font-medium">Min Age</label>
                  <Input 
                  type="number"
                  placeholder="Min"
                  value={filter.min ?? ''}
                  onChange={(e) => updateRetirementAgeFilter(index, 'min', e.target.value)}
                  />
              </div>
              <div className="flex-1">
                  <label className="text-xs font-medium">Max Age</label>
                  <Input 
                  type="number"
                  placeholder="Max"
                  value={filter.max ?? ''}
                  onChange={(e) => updateRetirementAgeFilter(index, 'max', e.target.value)}
                  />
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeRetirementAgeFilter(index)} className="mt-4" aria-label="Remove retirement age filter">
                  <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
              </Button>
              </div>
          ))}
        </div>

      </CardContent>
    </Card>
  );
}