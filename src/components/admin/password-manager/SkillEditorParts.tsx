import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import type { WorkflowInputField, WorkflowStep } from '../../../shared/password-manager';
import { ListInput, NativeSelect } from './ui';

const fieldTypes: Record<WorkflowInputField['type'], string> = {
  text: 'Text',
  number: 'Number',
  amount: 'Amount (rand)',
  choice: 'Choice',
  document: 'Document',
  fields: 'Several fields',
};

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function InputsEditor({
  value,
  onChange,
}: {
  value: WorkflowInputField[];
  onChange: (value: WorkflowInputField[]) => void;
}) {
  const update = (i: number, patch: Partial<WorkflowInputField>) =>
    onChange(value.map((row, n) => (n === i ? { ...row, ...patch } : row)));
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold">Inputs</legend>
      {!value.length && (
        <p className="text-sm text-muted-foreground">This workflow needs no inputs.</p>
      )}
      {value.map((row, i) => (
        <div key={i} className="grid gap-2 rounded-md border p-2 sm:grid-cols-[1fr_9rem_auto_auto]">
          <Input
            aria-label={`Input ${i + 1} name`}
            placeholder="Name, for example policyNumber"
            value={row.name}
            onChange={(e) => update(i, { name: e.target.value })}
          />
          <NativeSelect
            aria-label={`Input ${i + 1} type`}
            value={row.type}
            onChange={(e) => update(i, { type: e.target.value as WorkflowInputField['type'] })}
          >
            {(Object.keys(fieldTypes) as WorkflowInputField['type'][]).map((t) => (
              <option key={t} value={t}>
                {fieldTypes[t]}
              </option>
            ))}
          </NativeSelect>
          <label className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={row.required}
              onChange={(e) => update(i, { required: e.target.checked })}
            />
            Required
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`Remove input ${i + 1}`}
            onClick={() => onChange(value.filter((_, n) => n !== i))}
          >
            <Trash2 />
          </Button>
          <Input
            aria-label={`Input ${i + 1} description`}
            placeholder="What it is"
            className="sm:col-span-4"
            value={row.description}
            onChange={(e) => update(i, { description: e.target.value })}
          />
          {row.type === 'choice' && (
            <ListInput
              aria-label={`Input ${i + 1} choices`}
              placeholder="Choices, separated by commas"
              className="h-10 sm:col-span-4"
              value={row.choices ?? []}
              onChange={(choices) => update(i, { choices })}
            />
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() =>
          onChange([...value, { name: '', type: 'text', required: true, description: '' }])
        }
      >
        <Plus />
        Add input
      </Button>
    </fieldset>
  );
}

export function StepsEditor({
  value,
  onChange,
}: {
  value: WorkflowStep[];
  onChange: (value: WorkflowStep[]) => void;
}) {
  const update = (i: number, patch: Partial<WorkflowStep>) =>
    onChange(value.map((row, n) => (n === i ? { ...row, ...patch } : row)));
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-semibold">Steps</legend>
      <ol className="grid gap-2">
        {value.map((step, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
            <span className="w-6 text-sm text-muted-foreground">{i + 1}.</span>
            <Input
              aria-label={`Step ${i + 1}`}
              className="min-w-[12rem] flex-1"
              value={step.text}
              onChange={(e) => update(i, { text: e.target.value })}
            />
            <label className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={step.checkpoint}
                onChange={(e) => update(i, { checkpoint: e.target.checked })}
              />
              Checkpoint
            </label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Move step ${i + 1} up`}
              disabled={i === 0}
              onClick={() => onChange(move(value, i, i - 1))}
            >
              <ArrowUp />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Move step ${i + 1} down`}
              disabled={i === value.length - 1}
              onClick={() => onChange(move(value, i, i + 1))}
            >
              <ArrowDown />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Remove step ${i + 1}`}
              onClick={() => onChange(value.filter((_, n) => n !== i))}
            >
              <Trash2 />
            </Button>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        onClick={() => onChange([...value, { text: '', checkpoint: false }])}
      >
        <Plus />
        Add step
      </Button>
    </fieldset>
  );
}
