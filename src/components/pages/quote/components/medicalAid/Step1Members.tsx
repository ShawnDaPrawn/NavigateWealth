/**
 * Step 1 — who is on the policy.
 *
 * Split out of `MedicalAidQuoteWizard.tsx` (1,534 lines), where all five steps
 * shared one file with the wizard itself. It was already a self-contained
 * function with its own props; only its address changed.
 */
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import { Heart, Users, Plus, Minus } from 'lucide-react';
import { MEMBERSHIP_TYPES, type MemberEntry, type MembersState } from './model';

export function Step1Members({
  members,
  onChange,
}: {
  members: MembersState;
  onChange: (m: MembersState) => void;
}) {
  const updateMain = (field: keyof MemberEntry, value: string) => {
    onChange({ ...members, main: { ...members.main, [field]: value } });
  };

  const updateSpouse = (field: keyof MemberEntry, value: string) => {
    onChange({ ...members, spouse: { ...members.spouse, [field]: value } });
  };

  const updateChild = (index: number, field: keyof MemberEntry, value: string) => {
    const updated = [...members.children];
    updated[index] = { ...updated[index], [field]: value };
    onChange({ ...members, children: updated });
  };

  const setMembershipType = (type: string) => {
    const next: MembersState = { ...members, membership_type: type };
    // Reset spouse/children if switching to simpler type
    if (type === 'main_only') {
      next.spouse = { dob: '', age: '' };
      next.children = [];
    } else if (type === 'main_spouse') {
      next.children = [];
    } else if (type === 'family' && next.children.length === 0) {
      next.children = [{ dob: '', age: '' }];
    }
    onChange(next);
  };

  const addChild = () => {
    onChange({ ...members, children: [...members.children, { dob: '', age: '' }] });
  };

  const removeChild = (index: number) => {
    const updated = members.children.filter((_, i) => i !== index);
    onChange({ ...members, children: updated.length > 0 ? updated : [{ dob: '', age: '' }] });
  };

  const showSpouse =
    members.membership_type === 'main_spouse' || members.membership_type === 'family';
  const showChildren = members.membership_type === 'family';

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">Who needs cover?</h2>
        <p className="text-sm text-gray-500">
          Tell us about everyone who needs to be on the medical aid.
        </p>
      </div>

      {/* Membership type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">
          Membership type <span className="text-red-500">*</span>
        </Label>
        <div className="grid gap-2">
          {MEMBERSHIP_TYPES.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setMembershipType(opt.value)}
              className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                members.membership_type === opt.value
                  ? 'border-primary/50 bg-primary/[0.03]'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  members.membership_type === opt.value ? 'border-primary' : 'border-gray-300'
                }`}
              >
                {members.membership_type === opt.value && (
                  <div className="w-2 h-2 rounded-full bg-primary" />
                )}
              </div>
              <span className="text-sm font-medium text-gray-900">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main member */}
      {members.membership_type && (
        <div className="space-y-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Main member
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Date of birth (preferred)</Label>
              <Input
                type="date"
                value={members.main.dob}
                onChange={(e) => updateMain('dob', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="bg-white border-gray-300 h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Or age</Label>
              <Input
                type="number"
                min={0}
                max={120}
                placeholder="e.g. 34"
                value={members.main.age}
                onChange={(e) => updateMain('age', e.target.value)}
                className="bg-white border-gray-300 h-10"
                disabled={!!members.main.dob}
              />
            </div>
          </div>
        </div>
      )}

      {/* Spouse */}
      {showSpouse && (
        <div className="space-y-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Heart className="h-4 w-4 text-pink-500" />
            Spouse / Partner
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Date of birth (preferred)</Label>
              <Input
                type="date"
                value={members.spouse.dob}
                onChange={(e) => updateSpouse('dob', e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="bg-white border-gray-300 h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-600">Or age</Label>
              <Input
                type="number"
                min={0}
                max={120}
                placeholder="e.g. 32"
                value={members.spouse.age}
                onChange={(e) => updateSpouse('age', e.target.value)}
                className="bg-white border-gray-300 h-10"
                disabled={!!members.spouse.dob}
              />
            </div>
          </div>
        </div>
      )}

      {/* Children */}
      {showChildren && (
        <div className="space-y-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Children</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addChild}
              className="h-8 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" /> Add child
            </Button>
          </div>
          {members.children.map((child, i) => (
            <div key={i} className="bg-white rounded-lg border border-gray-200 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-gray-700">Child {i + 1}</span>
                {members.children.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeChild(i)}
                    className="text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">Date of birth</Label>
                  <Input
                    type="date"
                    value={child.dob}
                    onChange={(e) => updateChild(i, 'dob', e.target.value)}
                    max={new Date().toISOString().split('T')[0]}
                    className="bg-white border-gray-300 h-10"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-600">Or age</Label>
                  <Input
                    type="number"
                    min={0}
                    max={30}
                    placeholder="e.g. 7"
                    value={child.age}
                    onChange={(e) => updateChild(i, 'age', e.target.value)}
                    className="bg-white border-gray-300 h-10"
                    disabled={!!child.dob}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Step 2: Preferences ─────────────────────────────────────────────────────────
