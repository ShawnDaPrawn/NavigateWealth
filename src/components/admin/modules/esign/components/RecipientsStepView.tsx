/**
 * Recipients step of the envelope wizard (step 2 of dashboard → upload →
 * recipients → prepare). Pure view: the module root owns the wizard state
 * and passes the slice this step reads plus the handlers it fires.
 */
import React, { Suspense } from 'react';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
import { Label } from '../../../../ui/label';
import { Switch } from '../../../../ui/switch';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

import { StepFallback } from './StepFallback';
import type { TemplateContext } from '../wizardDerivations';
import type { SignerFormData } from '../types';

const RecipientsManager = React.lazy(() =>
  import('./RecipientsManager').then((m) => ({ default: m.RecipientsManager })),
);

interface RecipientsStepViewProps {
  signers: SignerFormData[];
  onSignersChange: (signers: SignerFormData[]) => void;
  templateContext: TemplateContext | null;
  /** True while the wizard is building/editing a reusable template, which
   *  hides the express-send shortcut (there is nothing to send yet). */
  isTemplateBuilder: boolean;
  canSend: boolean;
  autoPopulateSuggestedFields: boolean;
  onAutoPopulateChange: (value: boolean) => void;
  uploading: boolean;
  sending: boolean;
  onBack: () => void;
  onExpressSend: () => void;
  onNext: () => void;
}

export function RecipientsStepView({
  signers,
  onSignersChange,
  templateContext,
  isTemplateBuilder,
  canSend,
  autoPopulateSuggestedFields,
  onAutoPopulateChange,
  uploading,
  sending,
  onBack,
  onExpressSend,
  onNext,
}: RecipientsStepViewProps) {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold text-gray-900">Add Recipients</h2>
        <p className="text-sm text-gray-500">Who needs to sign these documents?</p>
      </div>

      {/* P4.3 — Express-send banner. When the wizard is using a
          template that already has a complete field layout, surface
          a clear shortcut so the user can skip the studio. */}
      {!isTemplateBuilder && templateContext && templateContext.template.fields.length > 0 && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-4 flex items-start gap-3">
          <div className="h-8 w-8 rounded-md bg-purple-100 flex items-center justify-center shrink-0">
            <ArrowRight className="h-4 w-4 text-purple-700" />
          </div>
          <div className="flex-1 text-sm">
            <p className="font-medium text-gray-900">
              Express send from "{templateContext.template.name}"
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              This template already has {templateContext.template.fields.length} field
              {templateContext.template.fields.length === 1 ? '' : 's'} placed. Fill in recipient
              emails, then send directly without opening the field studio.
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardContent className="p-6">
          <Suspense fallback={<StepFallback />}>
            <RecipientsManager signers={signers} onChange={onSignersChange} />
          </Suspense>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <Label
                htmlFor="auto-populate-suggested-fields"
                className="text-sm font-medium text-gray-900"
              >
                Auto-add suggested PDF fields
              </Label>
              <p className="text-xs text-muted-foreground max-w-2xl">
                When Navigate detects fillable fields or signature anchors during upload, add those
                suggestions automatically before the field studio opens. You can still move, edit,
                or delete them manually afterward.
              </p>
            </div>
            <Switch
              id="auto-populate-suggested-fields"
              checked={autoPopulateSuggestedFields}
              onCheckedChange={onAutoPopulateChange}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          {!isTemplateBuilder &&
            templateContext &&
            templateContext.template.fields.length > 0 &&
            canSend && (
              <Button
                type="button"
                variant="outline"
                onClick={onExpressSend}
                disabled={uploading || sending}
                className="border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                {uploading || sending ? (
                  <div className="contents">
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending…
                  </div>
                ) : (
                  <div className="contents">
                    Send now (express)
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </div>
                )}
              </Button>
            )}
          <Button
            onClick={onNext}
            disabled={uploading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {uploading ? (
              <div className="contents">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Envelope...
              </div>
            ) : (
              <div className="contents">
                Next: Prepare Fields
                <ArrowRight className="h-4 w-4 ml-2" />
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
