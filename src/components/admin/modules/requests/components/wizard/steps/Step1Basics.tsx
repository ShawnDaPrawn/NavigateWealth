import React from 'react';
import {
  RequestTemplate,
  RequestCategory,
  RequestType,
  ClientAssociationRule,
  TemplateStatus,
  RequestPriority,
  RequestStatus,
} from '../../../types';
import { useProviders } from '../../../../product-management/hooks/useProviders';
import { Label } from "../../../../../../ui/label";
import { Input } from "../../../../../../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../../../../ui/select";
import { RadioGroup, RadioGroupItem } from "../../../../../../ui/radio-group";
import { cn } from "../../../../../../ui/utils";

interface Step1BasicsProps {
  templateData: Partial<RequestTemplate>;
  updateTemplateData: (updates: Partial<RequestTemplate>) => void;
}

export function Step1Basics({ templateData, updateTemplateData }: Step1BasicsProps) {
  const { providers, isLoading: isLoadingProviders } = useProviders();

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-slate-900 mb-2">Template Basics</h3>
        <p className="text-sm text-slate-500">
          Configure the fundamental properties of your request template.
        </p>
      </div>

      <div className="space-y-8">
        {/* Template Name */}
        <div className="space-y-2">
          <Label htmlFor="name">
            Template Name <span className="text-red-500">*</span>
          </Label>
          <Input
            id="name"
            value={templateData.name || ''}
            onChange={(e) => updateTemplateData({ name: e.target.value })}
            placeholder="e.g., Section 14 Transfer - Sygnia"
            className="w-full"
          />
          <p className="text-xs text-slate-500">
            A clear, descriptive name that identifies the type of request
          </p>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="category">
            Category <span className="text-red-500">*</span>
          </Label>
          <Select
            value={templateData.category || ''}
            onValueChange={(value) => updateTemplateData({ category: value as RequestCategory })}
          >
            <SelectTrigger id="category" className="w-full">
              <SelectValue placeholder="Select category..." />
            </SelectTrigger>
            <SelectContent>
              {Object.values(RequestCategory).map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-slate-500">
            The business category this request belongs to
          </p>
        </div>

        {/* Request Type */}
        <div className="space-y-3">
          <Label>
            Request Type <span className="text-red-500">*</span>
          </Label>
          <RadioGroup
            value={templateData.requestType || ''}
            onValueChange={(value) => updateTemplateData({ requestType: value as RequestType })}
            className="grid grid-cols-1 md:grid-cols-2 gap-4"
          >
            {Object.values(RequestType).map((type) => (
              <label
                key={type}
                className={cn(
                  "flex flex-col p-4 border rounded-lg cursor-pointer transition-all hover:bg-slate-50",
                  templateData.requestType === type
                    ? "border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600"
                    : "border-slate-200"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <RadioGroupItem value={type} id={`type-${type}`} className="sr-only" />
                  <div className="font-medium text-sm text-slate-900">{type}</div>
                </div>
                <div className="text-xs text-slate-500">
                  {type === RequestType.ADMINISTRATIVE
                    ? 'For internal processes and administrative tasks'
                    : 'For quote generation and pricing requests'}
                </div>
              </label>
            ))}
          </RadioGroup>
        </div>

        {/* Client Association Rule */}
        <div className="space-y-3">
          <Label>
            Client Association <span className="text-red-500">*</span>
          </Label>
          <RadioGroup
            value={templateData.clientAssociationRule || ''}
            onValueChange={(value) => updateTemplateData({ clientAssociationRule: value as ClientAssociationRule })}
            className="space-y-2"
          >
            {Object.values(ClientAssociationRule).map((rule) => (
              <label
                key={rule}
                className={cn(
                  "flex items-center p-3 border rounded-lg cursor-pointer transition-all hover:bg-slate-50",
                  templateData.clientAssociationRule === rule
                    ? "border-indigo-600 bg-indigo-50/50"
                    : "border-slate-200"
                )}
              >
                <RadioGroupItem value={rule} id={`rule-${rule}`} className="mr-3 text-indigo-600" />
                <span className="text-sm font-medium text-slate-900">{rule}</span>
              </label>
            ))}
          </RadioGroup>
          <p className="text-xs text-slate-500">
            Whether this request must be linked to a client profile
          </p>
        </div>

        {/* Configuration Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
          <div className="space-y-2">
            <Label htmlFor="priority">Default Priority</Label>
            <Select
              value={templateData.defaultPriority || RequestPriority.MEDIUM}
              onValueChange={(value) =>
                updateTemplateData({ defaultPriority: value as RequestPriority })
              }
            >
              <SelectTrigger id="priority">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(RequestPriority).map((priority) => (
                  <SelectItem key={priority} value={priority}>
                    {priority}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              The default priority level for new requests
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="queue">Default Queue</Label>
            <Select
              value={templateData.defaultQueue || RequestStatus.NEW}
              onValueChange={(value) => updateTemplateData({ defaultQueue: value })}
            >
              <SelectTrigger id="queue">
                <SelectValue placeholder="Select queue" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(RequestStatus).map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              The queue where new requests will appear
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider">
              Provider Lane <span className="text-slate-400 font-normal">(Optional)</span>
            </Label>
            <Select
              value={(() => {
                if (!templateData.providerLane) return 'none';
                const isKnownProvider = providers.some(p => p.name === templateData.providerLane);
                return isKnownProvider ? templateData.providerLane : 'Other';
              })()}
              onValueChange={(value) => {
                if (value === 'none') {
                  updateTemplateData({ providerLane: undefined });
                } else if (value === 'Other') {
                  updateTemplateData({ providerLane: 'Other' });
                } else {
                  updateTemplateData({ providerLane: value });
                }
              }}
              disabled={isLoadingProviders}
            >
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-- Select Provider --</SelectItem>
                {providers.map((provider) => (
                  <SelectItem key={provider.id} value={provider.name}>
                    {provider.name}
                  </SelectItem>
                ))}
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>

            {/* Custom Provider Input */}
            {templateData.providerLane && 
             !providers.some(p => p.name === templateData.providerLane) && (
              <div className="mt-2 animate-in fade-in slide-in-from-top-1">
                <Input 
                  placeholder="Enter provider name" 
                  value={templateData.providerLane === 'Other' ? '' : templateData.providerLane}
                  onChange={(e) => updateTemplateData({ providerLane: e.target.value })}
                  className="w-full"
                  autoFocus
                />
              </div>
            )}

            <p className="text-xs text-slate-500">
              Specify a provider if this request is specific to them
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">
              Template Status <span className="text-red-500">*</span>
            </Label>
            <Select
              value={templateData.status || TemplateStatus.DRAFT}
              onValueChange={(value) => updateTemplateData({ status: value as TemplateStatus })}
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {Object.values(TemplateStatus).map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              Status determines if the template can be used
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
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
              <h4 className="text-sm font-medium text-blue-900 mb-1">About Templates</h4>
              <p className="text-xs text-blue-700 leading-relaxed">
                Templates define the structure and workflow for requests. Once you've configured
                the basics, you'll set up the request details schema, assignees, compliance rules,
                lifecycle stages, and finalisation requirements in the following steps.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
