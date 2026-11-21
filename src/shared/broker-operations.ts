// Origins have to be reviewed before credentials can be used by the report runner.
export const providers = {
  'allan-gray': { name: 'Allan Gray' },
  brightrock: { name: 'BrightRock' },
  'capital-legacy': { name: 'Capital Legacy' },
} as const;
export type Provider = keyof typeof providers;
export type Broker = { id: string; name: string };
export interface PortalProfile {
  provider: Provider;
  brokerage: string;
  purpose: string;
  homeUrl: string;
  expectedIdentity: string;
  mfaPrompt: string;
  brokers: { brokerId: string; code: string }[];
}
export const selectorFields = [
  'username',
  'password',
  'submit',
  'identity',
  'brokerSelect',
  'brokerCode',
  'monthSelect',
  'reportRow',
  'rowBroker',
  'rowMonth',
  'documentLink',
  'emptyState',
] as const;
export type Selectors = Record<(typeof selectorFields)[number], string>;
export type Workflow = {
  id: string;
  name: string;
  provider: Provider;
  kind: 'test_login' | 'monthly_statement';
  selectors: Selectors;
};
export type RunState =
  'queued' | 'running' | 'awaiting_mfa' | 'completed' | 'missing' | 'failed' | 'cancelled';
export type PortalRun = {
  id: string;
  batchId: string;
  actor: string;
  accountId: string;
  accountName: string;
  brokerId: string;
  brokerName: string;
  code: string;
  provider: Provider;
  workflowId: string;
  workflowName: string;
  kind: Workflow['kind'];
  month: string;
  state: RunState;
  message: string;
  createdAt: string;
  updatedAt: string;
  deadline: number;
  verifiedIdentity?: string;
  verifiedAt?: string;
  document?: string;
};
export type ConnectionInfo = {
  id: string;
  name: string;
  redirectUri: string;
  createdAt: string;
  lastUsed: string | null;
  expiresAt: string;
};

// Only these labels and viewport coordinates cross the browser boundary.
export const checkpointLabels = [
  'Heading',
  'Link',
  'Button',
  'Input',
  'Password field',
  'Select',
  'Sign in',
  'Log in',
  'Continue',
  'Approve',
  'Verify',
  'Statements',
  'Reports',
  'Download',
  'Broker',
  'Month',
] as const;
export type PortalCheckpoint = {
  stage: 'signin' | 'approval' | 'account' | 'report';
  origin: string;
  updatedAt: string;
  controls: Array<{
    label: (typeof checkpointLabels)[number];
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
};
