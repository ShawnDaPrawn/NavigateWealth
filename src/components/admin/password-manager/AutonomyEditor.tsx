import { CurrencyInputField } from '../../ui/currency-input';
import { NumberInputField } from '../../ui/number-input';
import {
  actionLabels,
  actionModes,
  approverLabels,
  autonomyLevels,
  autonomyPreset,
  checkLabels,
  checkModes,
  type ActionKey,
  type ActionMode,
  type Approver,
  type AutonomyLevel,
  type AutonomyPolicy,
  type CheckKey,
  type CheckMode,
} from '../../../shared/password-manager';
import { DsSegmented } from '../layout/page/ds';
import { Field, NativeSelect } from './ui';

export default function AutonomyEditor({
  value,
  onChange,
}: {
  value: AutonomyPolicy;
  onChange: (value: AutonomyPolicy) => void;
}) {
  const custom = (patch: Partial<AutonomyPolicy>) =>
    onChange({ ...value, ...patch, level: 'custom' });
  const limit = (key: keyof AutonomyPolicy['limits'], amount: number | undefined) =>
    custom({ limits: { ...value.limits, [key]: amount === undefined ? null : amount } });

  return (
    <div className="grid gap-4">
      <div className="grid gap-1">
        <span className="text-sm font-medium">Autonomy</span>
        <DsSegmented<AutonomyLevel | 'custom'>
          label="Autonomy preset"
          value={value.level}
          onChange={(level) => level !== 'custom' && onChange(autonomyPreset(level))}
          options={(Object.keys(autonomyLevels) as AutonomyLevel[]).map((level) => ({
            value: level,
            label: autonomyLevels[level],
          }))}
        />
        <span className="text-xs text-muted-foreground">
          {value.level === 'custom'
            ? 'Custom — you changed lines below.'
            : value.level === 'full'
              ? 'Everything runs on its own. Only blocking checks stop the AI.'
              : value.level === 'checks'
                ? 'The AI asks a person only when a check fails.'
                : 'A person approves every change; read-only work runs on its own.'}
        </span>
      </div>

      <table className="w-full text-sm">
        <caption className="text-left font-medium">Action by action</caption>
        <tbody>
          {(Object.keys(actionLabels) as ActionKey[]).map((key) => (
            <tr key={key} className="border-t">
              <td className="py-1.5 pr-2">{actionLabels[key]}</td>
              <td className="w-52 py-1.5">
                <NativeSelect
                  aria-label={actionLabels[key]}
                  className="h-9"
                  value={value.actions[key]}
                  onChange={(e) =>
                    custom({ actions: { ...value.actions, [key]: e.target.value as ActionMode } })
                  }
                >
                  {(Object.keys(actionModes) as ActionMode[]).map((mode) => (
                    <option key={mode} value={mode}>
                      {actionModes[mode]}
                    </option>
                  ))}
                </NativeSelect>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="w-full text-sm">
        <caption className="text-left font-medium">Checks</caption>
        <tbody>
          {(Object.keys(checkLabels) as CheckKey[]).map((key) => (
            <tr key={key} className="border-t">
              <td className="py-1.5 pr-2">{checkLabels[key]}</td>
              <td className="w-52 py-1.5">
                <NativeSelect
                  aria-label={checkLabels[key]}
                  className="h-9"
                  value={value.checks[key]}
                  onChange={(e) =>
                    custom({ checks: { ...value.checks, [key]: e.target.value as CheckMode } })
                  }
                >
                  {(Object.keys(checkModes) as CheckMode[]).map((mode) => (
                    <option key={mode} value={mode}>
                      {checkModes[mode]}
                    </option>
                  ))}
                </NativeSelect>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Per instruction (R)" hint="Empty means no limit.">
          <CurrencyInputField
            placeholder="No limit"
            value={value.limits.perInstruction}
            onValueChange={(amount) => limit('perInstruction', amount)}
          />
        </Field>
        <Field label="Per day (R)" hint="Empty means no limit.">
          <CurrencyInputField
            placeholder="No limit"
            value={value.limits.perDay}
            onValueChange={(amount) => limit('perDay', amount)}
          />
        </Field>
        <Field label="Sign-ins per hour" hint="Empty means no limit.">
          <NumberInputField
            placeholder="No limit"
            value={value.limits.signInsPerHour}
            onValueChange={(amount) => limit('signInsPerHour', amount || undefined)}
          />
        </Field>
        <Field label="Hold money moves (minutes)" hint="Time to cancel before it is submitted.">
          <NumberInputField
            value={value.holdMinutes}
            onValueChange={(minutes) => custom({ holdMinutes: minutes ?? 0 })}
          />
        </Field>
        <Field label="Who approves" className="sm:col-span-2">
          <NativeSelect
            value={value.approver}
            onChange={(e) => onChange({ ...value, approver: e.target.value as Approver })}
          >
            {(Object.keys(approverLabels) as Approver[]).map((a) => (
              <option key={a} value={a}>
                {approverLabels[a]}
              </option>
            ))}
          </NativeSelect>
        </Field>
      </div>
    </div>
  );
}
