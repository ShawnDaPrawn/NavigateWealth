import { describe, expect, it } from 'vitest';
import { autoMapTemplateFields, suggestTemplateFieldMapping } from '../template-field-mapping';

describe('template-field-mapping', () => {
  it('auto-maps common PDF field names', () => {
    const fields = [
      { id: '1', name: 'FirstName', label: 'FirstName', type: 'text' as const },
      { id: '2', name: 'DOB', label: 'DOB', type: 'text' as const },
      { id: '3', name: 'Cell_Number', label: 'Cell Number', type: 'text' as const },
      { id: '4', name: 'TaxReferenceNumber', label: 'Tax Reference Number', type: 'text' as const },
    ];

    const mapped = autoMapTemplateFields(fields).fields;

    expect(mapped[0].canonicalKey).toBe('profile_first_name');
    expect(mapped[1].canonicalKey).toBe('profile_date_of_birth');
    expect(mapped[2].canonicalKey).toBe('profile_phone_number');
    expect(mapped[3].canonicalKey).toBe('profile_tax_number');
  });

  it('avoids mapping ambiguous generic labels', () => {
    expect(suggestTemplateFieldMapping({ name: 'Name', label: 'Name' })).toBeUndefined();
  });

  it('preserves existing mappings when onlyUnmapped is enabled', () => {
    const fields = [
      {
        id: '1',
        name: 'FirstName',
        label: 'First Name',
        type: 'text' as const,
        canonicalKey: 'derived:full_name',
      },
      {
        id: '2',
        name: 'DOB',
        label: 'DOB',
        type: 'text' as const,
      },
    ];

    const mapped = autoMapTemplateFields(fields, { onlyUnmapped: true }).fields;

    expect(mapped[0].canonicalKey).toBe('derived:full_name');
    expect(mapped[1].canonicalKey).toBe('profile_date_of_birth');
  });
});
