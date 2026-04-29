import { existsSync, readFileSync } from 'node:fs';

const DEFAULT_INGEST_URL = 'https://vpjmdsltwrnpefzcgdmz.supabase.co/functions/v1/make-server-91ed8379/quality-issues/ingest-security-report';
const token = process.env.QUALITY_ISSUES_INGEST_TOKEN;
const inputPath = process.argv[2] || process.env.QUALITY_SECURITY_REPORT_PATH;

function normalizeIngestUrl(value) {
  const rawValue = typeof value === 'string' ? value.trim() : '';
  if (!rawValue) return DEFAULT_INGEST_URL;

  const parsed = new URL(rawValue);
  if (parsed.pathname.endsWith('/quality-issues')) {
    parsed.pathname = `${parsed.pathname}/ingest-security-report`;
  } else if (parsed.pathname.endsWith('/quality-issues/')) {
    parsed.pathname = `${parsed.pathname}ingest-security-report`;
  }

  return parsed.toString();
}

function readPayload(path) {
  if (!path) {
    throw new Error('Provide a security report path as the first argument or QUALITY_SECURITY_REPORT_PATH.');
  }

  if (!existsSync(path)) {
    throw new Error(`Security report file not found: ${path}`);
  }

  return JSON.parse(readFileSync(path, 'utf8'));
}

if (!token) {
  throw new Error('QUALITY_ISSUES_INGEST_TOKEN is required to publish a security intake report.');
}

const endpoint = normalizeIngestUrl(process.env.QUALITY_ISSUES_INGEST_URL);
const payload = readPayload(inputPath);

console.log(`Publishing security intake report to ${endpoint}`);

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  },
  body: JSON.stringify(payload),
});

if (!response.ok) {
  const body = await response.text();
  throw new Error(
    `Failed to publish security intake report: ${response.status} ${response.statusText}\n${body.slice(0, 1600)}`,
  );
}

const result = await response.json();
console.log(`Published ${Array.isArray(result.issues) ? result.issues.length : 0} security issue(s).`);
