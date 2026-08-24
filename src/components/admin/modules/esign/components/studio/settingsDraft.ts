/**
 * The editable copy of an envelope's settings, held while the dialog is open.
 *
 * Named here because the dialog and the studio need it once they live in
 * different files; it was an inferred inline type while they shared one.
 */
export interface SettingsDraft {
  title: string;
  message: string;
  expiryDays: number;
  signingMode: 'sequential' | 'parallel';
}
