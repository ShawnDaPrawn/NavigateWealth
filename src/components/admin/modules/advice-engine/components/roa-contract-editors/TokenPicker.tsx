/**
 * TokenPicker — Inserts a template token into whichever field asked for one.
 *
 * Extracted verbatim from RoAModuleContractManager.tsx (2,125 lines). Behaviour
 * unchanged; only the imports are new.
 */
import React from 'react';
import { Button } from '../../../../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import type { TemplateTokenOption } from '../roaContractHelpers';

export function TokenPicker({
  tokens,
  onInsert,
}: {
  tokens: TemplateTokenOption[];
  onInsert: (token: string) => void;
}) {
  const [group, setGroup] = React.useState<string>('Client');
  const groups = React.useMemo(
    () => Array.from(new Set(tokens.map((token) => token.group))),
    [tokens],
  );
  const visibleTokens = tokens.filter((token) => token.group === group);

  React.useEffect(() => {
    if (!groups.includes(group) && groups.length > 0) setGroup(groups[0]);
  }, [group, groups]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={group} onValueChange={setGroup}>
        <SelectTrigger className="h-8 w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {groups.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex max-w-full flex-wrap gap-1">
        {visibleTokens.slice(0, 8).map((option) => (
          <Button
            key={option.token}
            type="button"
            variant="outline"
            size="sm"
            title={option.description}
            onClick={() => onInsert(option.token)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
