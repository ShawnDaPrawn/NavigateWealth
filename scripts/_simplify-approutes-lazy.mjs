import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const file = path.join(root, 'src/AppRoutes.tsx');
let s = fs.readFileSync(file, 'utf8');

// Single-line: const X = React.lazy(() => import('PATH').then(m => ({ default: m.X })));
s = s.replace(
  /const (\w+) = React\.lazy\(\(\) => import\((['"])([^'"]+)\2\)\.then\(m => \(\{ default: m\.\w+ \}\)\)\);/g,
  "const $1 = React.lazy(() => import($2$3$2));",
);

// Split-line QuoteServiceContactPage / ScheduleConsultationPage style (if still present)
s = s.replace(
  /const (\w+) = React\.lazy\(\(\) =>\s*\n\s*import\((['"])([^'"]+)\2\)\.then\(m => \(\{ default: m\.\w+ \}\)\),\s*\n\);/g,
  'const $1 = React.lazy(() => import($2$3$2));\n',
);

fs.writeFileSync(file, s);
console.log('AppRoutes.tsx lazy imports simplified');
