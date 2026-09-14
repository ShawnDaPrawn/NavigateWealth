/**
 * Recipients step — step 2 of the send-for-signature flow.
 *
 * Content only: the heading, the progress rail and the Back/Continue bar
 * belong to `EsignWizardShell`. Both entry points (the standalone module and
 * the client drawer's E-Sign tab) render this same step, so a change to how
 * recipients are gathered lands in both places at once.
 */
import { Users, Zap } from 'lucide-react';

import { Label } from '../../../../ui/label';
import { Switch } from '../../../../ui/switch';
import { EsignWizardSection } from './wizard';

import { canExpressSend, type TemplateContext } from '../wizardDerivations';
import type { SignerFormData } from '../types';
import { RecipientsManager, type ClientContext } from './RecipientsManager';

interface RecipientsStepViewProps {
  signers: SignerFormData[];
  onSignersChange: (signers: SignerFormData[]) => void;
  templateContext?: TemplateContext | null;
  /** True while the wizard is building/editing a reusable template, which
   *  hides the express-send shortcut (there is nothing to send yet). */
  isTemplateBuilder?: boolean;
  autoPopulateSuggestedFields: boolean;
  onAutoPopulateChange: (value: boolean) => void;
  /** When set, this client is pre-filled as the first recipient (removable). */
  clientContext?: ClientContext;
  disabled?: boolean;
}

export function RecipientsStepView({
  signers,
  onSignersChange,
  templateContext,
  isTemplateBuilder,
  autoPopulateSuggestedFields,
  onAutoPopulateChange,
  clientContext,
  disabled = false,
}: RecipientsStepViewProps) {
  const expressAvailable = canExpressSend(templateContext, isTemplateBuilder);

  return (
    <div className="space-y-6">
      {/* P4.3 — Express-send banner. When the wizard is using a template that
          already has a complete field layout, surface a clear shortcut so the
          user can skip the studio. */}
      {expressAvailable && templateContext && (
        <div className="flex items-start gap-3 rounded-xl border border-purple-200 bg-purple-50 p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
            <Zap className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="flex-1 text-sm">
            <p className="font-medium text-gray-900">
              Express send from "{templateContext.template.name}"
            </p>
            <p className="mt-0.5 text-xs text-gray-600">
              This template already has {templateContext.template.fields.length} field
              {templateContext.template.fields.length === 1 ? '' : 's'} placed. Fill in recipient
              emails, then use <span className="font-medium">Send now</span> below to skip the field
              studio.
            </p>
          </div>
        </div>
      )}

      <EsignWizardSection
        icon={Users}
        title="Recipients"
        description="Everyone who has to sign, in signing order. Drag to reorder."
        action={
          signers.length > 0 ? (
            <span className="text-xs font-medium text-gray-500">
              {signers.length} recipient{signers.length === 1 ? '' : 's'}
            </span>
          ) : undefined
        }
      >
        <RecipientsManager
          signers={signers}
          onChange={onSignersChange}
          clientContext={clientContext}
          disabled={disabled}
        />
      </EsignWizardSection>

      <EsignWizardSection>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <Label
              htmlFor="auto-populate-suggested-fields"
              className="text-sm font-medium text-gray-900"
            >
              Auto-add suggested PDF fields
            </Label>
            <p className="max-w-2xl text-xs text-gray-500">
              When Navigate detects fillable fields or signature anchors during upload, add those
              suggestions automatically before the field studio opens. You can still move, edit, or
              delete them afterwards.
            </p>
          </div>
          <Switch
            id="auto-populate-suggested-fields"
            checked={autoPopulateSuggestedFields}
            onCheckedChange={onAutoPopulateChange}
            disabled={disabled}
          />
        </div>
      </EsignWizardSection>
    </div>
  );
}
