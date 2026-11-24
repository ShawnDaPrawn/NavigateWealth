import { describe, it, expect } from 'vitest';
import { importCsv } from '../importCsv';
describe('password CSV import', () => {
  it('reads browser exports verbatim, including multiline fields and quoted delimiters', () => {
    expect(
      importCsv(
        '\uFEFFname,url,username,password,note\r\nPortal,https://example.com,001," 0,""x"" ","a\r\nb"\r\n',
      ),
    ).toEqual([
      {
        name: 'Portal',
        url: 'https://example.com',
        username: '001',
        password: ' 0,"x" ',
        notes: 'a\r\nb',
      },
    ]);
  });
  it.each([
    'url,username,password\na,b,"oops',
    'url,username,password\na,b,"oops"x',
    'url,username,password\na,b',
    'url,password,password\na,b,c',
    'url,username,password\n',
    'url,username,password\n' + 'a,b,c\n'.repeat(101),
  ])('rejects malformed or oversized imports', (csv) => expect(() => importCsv(csv)).toThrow());
});
