/**
 * Step 1 — who is making the will.
 *
 * Split out of `WillDraftingFlow.tsx` (1,605 lines), where all six steps shared
 * one `return`. Presentational — it owns no state; the flow holds the draft and
 * passes down only the slice this step edits.
 */
import { Input } from '../../../ui/input';
import { Label } from '../../../ui/label';
import { Textarea } from '../../../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { MARITAL_OPTIONS, type PersonalInfo } from './model';

interface StepPersonalDetailsProps {
  personalInfo: PersonalInfo;
  updatePersonal: (field: keyof PersonalInfo, value: string) => void;
}

export function StepPersonalDetails({ personalInfo, updatePersonal }: StepPersonalDetailsProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">
            First Name <span className="text-red-500">*</span>
          </Label>
          <Input
            value={personalInfo.firstName}
            onChange={(e) => updatePersonal('firstName', e.target.value)}
            placeholder="e.g. Sarah"
            className="h-10 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">
            Surname <span className="text-red-500">*</span>
          </Label>
          <Input
            value={personalInfo.surname}
            onChange={(e) => updatePersonal('surname', e.target.value)}
            placeholder="e.g. van der Merwe"
            className="h-10 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">SA ID Number</Label>
          <Input
            value={personalInfo.idNumber}
            onChange={(e) => updatePersonal('idNumber', e.target.value)}
            placeholder="e.g. 8501015800089"
            maxLength={13}
            className="h-10 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">Date of Birth</Label>
          <Input
            type="date"
            value={personalInfo.dateOfBirth}
            onChange={(e) => updatePersonal('dateOfBirth', e.target.value)}
            className="h-10 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">Marital Status</Label>
          <Select
            value={personalInfo.maritalStatus}
            onValueChange={(v) => updatePersonal('maritalStatus', v)}
          >
            <SelectTrigger className="h-10 text-sm">
              <SelectValue placeholder="Select marital status" />
            </SelectTrigger>
            <SelectContent>
              {MARITAL_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {personalInfo.maritalStatus &&
          personalInfo.maritalStatus !== 'Single' &&
          personalInfo.maritalStatus !== 'Divorced' &&
          personalInfo.maritalStatus !== 'Widowed' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Spouse Full Name</Label>
              <Input
                value={personalInfo.spouseName}
                onChange={(e) => updatePersonal('spouseName', e.target.value)}
                placeholder="Spouse's full legal name"
                className="h-10 text-sm"
              />
            </div>
          )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700">Physical Address</Label>
        <Textarea
          value={personalInfo.address}
          onChange={(e) => updatePersonal('address', e.target.value)}
          placeholder="Full residential address"
          rows={2}
          className="text-sm resize-none"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">
            Email <span className="text-red-500">*</span>
          </Label>
          <Input
            type="email"
            value={personalInfo.email}
            onChange={(e) => updatePersonal('email', e.target.value)}
            placeholder="email@example.co.za"
            className="h-10 text-sm"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-gray-700">Cellphone</Label>
          <Input
            type="tel"
            value={personalInfo.cellphone}
            onChange={(e) => updatePersonal('cellphone', e.target.value)}
            placeholder="+27 82 000 0000"
            className="h-10 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
