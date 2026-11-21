export interface CredentialInput {
  name: string;
  url: string;
  username: string;
  password: string;
  notes: string;
}

export interface VaultSummary extends Pick<CredentialInput, 'name' | 'url' | 'username'> {
  id: string;
  revision: string;
  connectionExpiresAt: string | null;
}

export interface VaultPage {
  items: VaultSummary[];
  nextCursor: string | null;
}
