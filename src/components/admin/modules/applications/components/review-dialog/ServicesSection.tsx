import { Target } from 'lucide-react';
import { Badge } from '../../../../../ui/badge';
import { Label } from '../../../../../ui/label';
import { Textarea } from '../../../../../ui/textarea';
import { ReviewSection, ViewField, SectionProps } from './shared';

export function ServicesSection({ isEditing, fv, updateField, amendedFields, data }: SectionProps) {
  const services = data?.accountReasons || [];

  return (
    <ReviewSection
      icon={Target}
      title="Services & Interests"
      badge={
        <span className="text-[11px] text-gray-400 font-normal ml-2">
          {services.length} selected
        </span>
      }
    >
      {isEditing ? (
        <div className="space-y-3">
          <div>
            <Label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-2 block">
              Financial Goals
            </Label>
            <Textarea
              className="text-sm bg-gray-50/60 border-gray-200 focus:bg-white transition-colors min-h-[60px]"
              value={fv('financialGoals')}
              onChange={(e) => updateField('financialGoals', e.target.value)}
              placeholder="Financial goals"
            />
          </div>
          {services.length > 0 && (
            <div>
              <Label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-2 block">
                Services Requested (view only)
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {services.map((r: string) => (
                  <Badge
                    key={r}
                    className="text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5"
                  >
                    {r}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="contents">
          <div className="mb-4">
            <Label className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-2 block">
              Services Requested
            </Label>
            {services.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {services.map((r: string) => (
                  <Badge
                    key={r}
                    className="text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 px-2.5 py-0.5"
                  >
                    {r}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-sm text-gray-300 italic">None selected</span>
            )}
          </div>
          {data?.otherReason && (
            <div className="mb-4">
              <ViewField label="Other Reason Specified" value={data.otherReason} />
            </div>
          )}
          {data?.financialGoals && (
            <div className="pt-3 border-t border-gray-100">
              <ViewField
                label="Financial Goals"
                value={data.financialGoals}
                amended={amendedFields.has('financialGoals')}
              />
            </div>
          )}
        </div>
      )}
    </ReviewSection>
  );
}
