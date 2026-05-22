export type UnsavedChangesGuardOptions = {
  isDirty: boolean;
  onSave: () => Promise<boolean>;
  onDiscard: () => void;
  enabled?: boolean;
  message?: string;
};

export type UnsavedChangesDialogProps = {
  open: boolean;
  message: string;
  isSaving: boolean;
  onStay: () => void;
  onDiscard: () => void;
  onSaveAndLeave: () => void;
};

export type UnsavedChangesRegistryEntry = {
  id: string;
  isDirty: boolean;
  tryAction: (action: () => void) => void;
};

export type UnsavedChangesRegistryContextValue = {
  register: (entry: UnsavedChangesRegistryEntry) => void;
  unregister: (id: string) => void;
  getDirtyEntries: () => UnsavedChangesRegistryEntry[];
  tryLeaveAny: (action: () => void) => boolean;
};
