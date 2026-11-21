import type { PortalProfile } from './broker-operations.ts';
export interface CredentialInput {
  name: string;
  url: string;
  username: string;
  password: string;
  notes: string;
  portal?: PortalProfile;
}

export interface VaultSummary extends Pick<CredentialInput, 'name' | 'url' | 'username'> {
  portal?: PortalProfile;
  id: string;
  revision: string;
  connectionExpiresAt: string | null;
}

export interface VaultPage {
  items: VaultSummary[];
  nextCursor: string | null;
}
