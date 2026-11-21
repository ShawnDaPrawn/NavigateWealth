import type { CredentialInput } from '../../../shared/password-manager';

// Passwords must survive quoted commas, line breaks, escaped quotes and leading zeroes verbatim.
export function importCsv(text: string): CredentialInput[] {
  const rows: string[][] = [];
  let row: string[] = [],
    field = '',
    quoted = false,
    closed = false;
  const finishRow = () => {
    row.push(field);
    if (row.length > 1 || row[0] !== '') rows.push(row);
    if (rows.length > 101) throw new Error('Import up to 100 credentials at a time.');
    row = [];
    field = '';
    closed = false;
  };
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch !== '"') field += ch;
      else if (source[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        quoted = false;
        closed = true;
      }
    } else if (ch === ',') {
      row.push(field);
      field = '';
      closed = false;
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      finishRow();
    } else if (ch === '"' && !closed && !field) quoted = true;
    else if (closed || ch === '"') throw new Error('Invalid quoting in the CSV file.');
    else field += ch;
  }
  if (quoted) throw new Error('Unclosed quoted field in the CSV file.');
  finishRow();
  const headers = (rows.shift() ?? [])
    .map((h) => h.trim().toLowerCase())
    .map((h) => (h === 'note' ? 'notes' : h));
  if (
    !['url', 'username', 'password'].every((h) => headers.includes(h)) ||
    new Set(headers).size !== headers.length
  )
    throw new Error('Use unique column headers including url, username and password.');
  if (!rows.length) throw new Error('The CSV file has no credentials.');
  return rows.map((cells, index) => {
    const cell = (key: string) => cells[headers.indexOf(key)] ?? '';
    if (cells.length !== headers.length || !cell('url').trim() || !cell('password'))
      throw new Error(
        'Check the column count, URL and password in CSV record ' + (index + 2) + '.',
      );
    return {
      name: cell('name'),
      url: cell('url'),
      username: cell('username'),
      password: cell('password'),
      notes: cell('notes'),
    };
  });
}
