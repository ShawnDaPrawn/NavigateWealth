import React, { useCallback, useState } from 'react';
import { Button } from '../../../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../ui/dropdown-menu';
import { Sparkles } from 'lucide-react';
import type { FormPrefillId } from '../../../../shared/form-prefill/types';
import { resolveFormPrefill } from '../../../../services/form-prefill-api';
import { isFormPrefillEnabled } from '../../../../utils/formPrefillFeature';
import { PrefillReviewModal } from './PrefillReviewModal';
import { toast } from 'sonner@2.0.3';

const DOMAIN_OPTIONS: { label: string; formId: FormPrefillId }[] = [
  { label: 'Retirement FNA', formId: 'retirement-fna-step1' },
  { label: 'Risk Planning FNA', formId: 'risk-fna-step1' },
  { label: 'Medical FNA', formId: 'medical-fna-step1' },
  { label: 'Tax Planning FNA', formId: 'tax-fna-step1' },
  { label: 'Estate Planning FNA', formId: 'estate-fna-step1' },
  { label: 'Investment INA', formId: 'investment-ina-step1' },
];

interface PrefillDomainPickerProps {
  clientId: string;
}

export function PrefillDomainPicker({ clientId }: PrefillDomainPickerProps) {
  const [loading, setLoading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [activeFormId, setActiveFormId] = useState<FormPrefillId>('retirement-fna-step1');
  const [result, setResult] = useState<Awaited<ReturnType<typeof resolveFormPrefill>> | null>(null);

  const openDomain = useCallback(
    async (formId: FormPrefillId) => {
      setActiveFormId(formId);
      setLoading(true);
      try {
        const response = await resolveFormPrefill({
          clientId,
          formId,
          currentFormValues: {},
          options: { includePolicies: true, includeClientKeys: true },
        });
        setResult(response);
        setReviewOpen(true);
        if (response.matches.length === 0) {
          toast.info('No client data matches found for this form.');
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to load prefill matches');
      } finally {
        setLoading(false);
      }
    },
    [clientId],
  );

  if (!isFormPrefillEnabled()) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" size="sm" variant="outline" disabled={loading}>
            <Sparkles className="h-4 w-4 mr-2 text-purple-600" />
            Prefill FNA data
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Preview domain prefill</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {DOMAIN_OPTIONS.map((option) => (
            <DropdownMenuItem key={option.formId} onClick={() => void openDomain(option.formId)}>
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <PrefillReviewModal
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        loading={loading}
        result={result}
        clientId={clientId}
        previewOnly
        onRefresh={async () => {
          setLoading(true);
          try {
            const response = await resolveFormPrefill({
              clientId,
              formId: activeFormId,
              currentFormValues: {},
              options: { includePolicies: true, includeClientKeys: true },
            });
            setResult(response);
            return response;
          } finally {
            setLoading(false);
          }
        }}
        onApply={() => {
          toast.info('Open the FNA wizard to apply selected values to a live form.');
          setReviewOpen(false);
        }}
        onSkip={() => setReviewOpen(false)}
      />
    </>
  );
}
