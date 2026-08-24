/**
 * Balance-sheet shapes shared by the client profile and the admin client
 * profile viewer.
 *
 * These two surfaces each carried their own byte-identical copy of these
 * interfaces (`pages/profile/types.ts` and
 * `admin/profile-sections/assetsLiabilitiesTypes.ts`). Two hand-maintained
 * copies of the same shape drift; both are now re-exports of this one.
 */
export interface Asset {
  id: string;
  type: string;
  name: string;
  description: string;
  value: number;
  ownershipType: string;
  provider: string;
  customType?: string;
}

export interface Liability {
  id: string;
  type: string;
  name: string;
  description: string;
  provider: string;
  outstandingBalance: number;
  monthlyPayment: number;
  interestRate: number;
  customType?: string;
}
