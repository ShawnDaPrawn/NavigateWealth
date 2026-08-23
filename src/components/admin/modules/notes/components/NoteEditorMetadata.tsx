/**
 * The metadata section of the note editor modal: tags, client link picker,
 * summary and converted-task indicators. JSX moved verbatim from
 * NoteEditorModal.tsx; every captured name became a prop.
 */
import React from 'react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Input } from '../../../../ui/input';
import { Label } from '../../../../ui/label';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../../../ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '../../../../ui/popover';
import {
  Check,
  CheckCircle2,
  ChevronsUpDown,
  Link2,
  Sparkles,
  Tag,
  Unlink,
  User,
} from 'lucide-react';
import { cn } from '../../../../ui/utils';

interface ClientOption {
  id: string;
  name: string;
}

interface NoteEditorMetadataProps {
  tagsInput: string;
  handleTagsChange: (val: string) => void;
  handleTagsBlur: () => void;
  clientId: string | null;
  clientName: string | null;
  clients: ClientOption[];
  clientPickerOpen: boolean;
  setClientPickerOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleClientChange: (val: string) => void;
  editorMode: 'write' | 'summarise';
  setEditorMode: React.Dispatch<React.SetStateAction<'write' | 'summarise'>>;
  localSummary: string | null;
  isConverted: boolean;
}

export function NoteEditorMetadata({
  tagsInput,
  handleTagsChange,
  handleTagsBlur,
  clientId,
  clientName,
  clients,
  clientPickerOpen,
  setClientPickerOpen,
  handleClientChange,
  editorMode,
  setEditorMode,
  localSummary,
  isConverted,
}: NoteEditorMetadataProps) {
  return (
    <div className="space-y-4">
      {/* Tags */}
      <div className="flex items-start gap-3">
        <Tag className="h-4 w-4 text-gray-400 mt-2.5 shrink-0" />
        <div className="flex-1">
          <Label className="text-xs font-medium text-gray-500 uppercase">Tags</Label>
          <Input
            value={tagsInput}
            onChange={(e) => handleTagsChange(e.target.value)}
            onBlur={handleTagsBlur}
            placeholder="meeting, follow-up, important (comma-separated)"
            className="h-9 text-sm mt-1"
          />
        </div>
      </div>

      {/* Client link */}
      <div className="flex items-start gap-3">
        <User className="h-4 w-4 text-gray-400 mt-2.5 shrink-0" />
        <div className="flex-1">
          <Label className="text-xs font-medium text-gray-500 uppercase">Link to Client</Label>
          {clients.length > 0 ? (
            <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen} modal={true}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={clientPickerOpen}
                  className="w-full justify-between h-9 text-sm mt-1 font-normal"
                >
                  <span className="flex items-center gap-2 truncate">
                    {clientId && clientName ? (
                      <span className="contents">
                        <Link2 className="h-3.5 w-3.5 text-purple-500 shrink-0" />
                        <span className="truncate">{clientName}</span>
                      </span>
                    ) : (
                      <span className="contents">
                        <Unlink className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span className="text-gray-500">No client linked</span>
                      </span>
                    )}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search clients..." />
                  <CommandList>
                    <CommandEmpty>No client found.</CommandEmpty>
                    <CommandGroup className="max-h-[240px] overflow-auto">
                      <CommandItem
                        value="__none__"
                        onSelect={() => {
                          handleClientChange('__none__');
                          setClientPickerOpen(false);
                        }}
                      >
                        <Check
                          className={cn('mr-2 h-4 w-4', !clientId ? 'opacity-100' : 'opacity-0')}
                        />
                        <Unlink className="h-3.5 w-3.5 text-gray-400" /> No client linked
                      </CommandItem>
                      {clients.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={`${c.name} ${c.id}`}
                          onSelect={() => {
                            handleClientChange(c.id);
                            setClientPickerOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              clientId === c.id ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <Link2 className="h-3.5 w-3.5 text-purple-500" /> {c.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          ) : clientName ? (
            <div className="flex items-center gap-2 mt-1">
              <Badge className="bg-purple-100 text-purple-700 border-purple-200">
                <User className="h-3 w-3 mr-1" /> {clientName}
              </Badge>
            </div>
          ) : (
            <p className="text-xs text-gray-400 mt-1">
              No clients available for linking. You can create notes from the client management
              screen to auto-link.
            </p>
          )}
        </div>
      </div>

      {/* Summary indicator */}
      {localSummary && editorMode === 'write' && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-purple-50 border border-purple-200">
          <Sparkles className="h-4 w-4 text-purple-600 shrink-0" />
          <span className="text-sm text-purple-800 flex-1">
            AI summary available — will be used when converting to task.
          </span>
          <button
            type="button"
            onClick={() => setEditorMode('summarise')}
            className="text-xs font-medium text-purple-700 hover:text-purple-900 underline underline-offset-2"
          >
            View
          </button>
        </div>
      )}

      {/* Converted task indicator */}
      {isConverted && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <span className="text-sm text-green-800">This note has been converted to a task.</span>
        </div>
      )}
    </div>
  );
}
