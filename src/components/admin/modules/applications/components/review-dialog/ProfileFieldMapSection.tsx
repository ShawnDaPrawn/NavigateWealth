import { Link2, ChevronDown, ChevronUp, CheckCircle2, ArrowRight } from 'lucide-react';
import { Badge } from '../../../../../ui/badge';
import { Label } from '../../../../../ui/label';
import {
  APPLICATION_PROFILE_FIELD_MAP,
  FIELD_MAP_BY_SECTION,
  SECTION_LABELS,
} from '../../constants';

interface ProfileFieldMapSectionProps {
  showFieldMap: boolean;
  onToggle: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

export function ProfileFieldMapSection({
  showFieldMap,
  onToggle,
  data,
}: ProfileFieldMapSectionProps) {
  return (
    <div className="rounded-xl border border-blue-200/60 bg-blue-50/30 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-blue-50/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
            <Link2 className="h-3.5 w-3.5 text-blue-600" />
          </div>
          <div>
            <span className="text-[13px] font-semibold text-gray-900">
              Profile Field Mapping Reference
            </span>
            <p className="text-[11px] text-gray-500 mt-0.5">
              {APPLICATION_PROFILE_FIELD_MAP.length} fields sync between Application and Client
              Profile on approval
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className="text-[10px] font-medium bg-blue-50 text-blue-700 border-blue-200"
          >
            {APPLICATION_PROFILE_FIELD_MAP.length} mapped
          </Badge>
          {showFieldMap ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </button>

      {showFieldMap && (
        <div className="px-5 pb-5 pt-1 border-t border-blue-200/40">
          <div className="space-y-4 mt-3">
            {Object.entries(FIELD_MAP_BY_SECTION).map(([section, mappings]) => (
              <div key={section}>
                <Label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2 block">
                  {SECTION_LABELS[section] || section}
                </Label>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50/60 border-b border-gray-100">
                        <th className="text-left py-1.5 px-3 font-medium text-gray-500 w-[35%]">
                          Application Field
                        </th>
                        <th className="text-center py-1.5 px-1 font-medium text-gray-400 w-[30px]" />
                        <th className="text-left py-1.5 px-3 font-medium text-gray-500 w-[35%]">
                          Client Profile Field
                        </th>
                        <th className="text-center py-1.5 px-3 font-medium text-gray-500 w-[20%]">
                          Has Value
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {mappings.map((m) => {
                        const val = data?.[m.applicationField];
                        const hasValue = val !== undefined && val !== null && val !== '';
                        return (
                          <tr
                            key={m.applicationField}
                            className="border-b border-gray-50 last:border-0"
                          >
                            <td className="py-1.5 px-3 text-gray-700 font-medium">{m.label}</td>
                            <td className="text-center px-1">
                              <ArrowRight className="h-3 w-3 text-blue-400 inline" />
                            </td>
                            <td className="py-1.5 px-3 text-gray-500 font-mono text-[10px]">
                              {m.profileField}
                            </td>
                            <td className="text-center py-1.5 px-3">
                              {hasValue ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 inline" />
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
