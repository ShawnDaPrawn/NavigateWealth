/**
 * Address Panel
 *
 * Phase 2 endpoint:
 * - Best known address: POST /natural-person-address
 *
 * Retrieves the client's best known address from credit bureau records.
 */

import { useState } from 'react';
import { Button } from '../../../../../ui/button';
import { Loader2 } from 'lucide-react';
import { Notice } from '../../../../layout/page';
import { ClientIdentificationCard } from './CheckBlocks';
import { PanelCard, StatusPill } from './ComplianceShared';
import { toast } from 'sonner';
import { api } from '../../../../../../utils/api';

interface AddressReportsPanelProps {
  clientId: string;
  firstName: string;
  lastName: string;
  idNumber: string | null;
  passport: string | null;
  hasIdentification: boolean;
  onCheckComplete?: () => void;
}

interface AddressResult {
  success: boolean;
  data?: Record<string, unknown>;
  matterId?: string;
  error?: string;
}

interface AddressEntry {
  line1?: string;
  line2?: string;
  suburb?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  country?: string;
  source?: string;
  lastReported?: string;
}

export function AddressReportsPanel({
  clientId,
  firstName,
  lastName,
  idNumber,
  passport,
  hasIdentification,
  onCheckComplete,
}: AddressReportsPanelProps) {
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [addressResult, setAddressResult] = useState<AddressResult | null>(null);
  const [showRawAddress, setShowRawAddress] = useState(false);

  const handleAddressLookup = async () => {
    setIsAddressLoading(true);
    setAddressResult(null);
    const toastId = toast.loading('Looking up best known address...');

    try {
      const data = await api.post<{ data?: Record<string, unknown>; matterId?: string }>(
        `/integrations/honeycomb/address/best-known`,
        { clientId, firstName, lastName, idNumber, passport },
      );

      setAddressResult({ success: true, data: data.data, matterId: data.matterId });
      toast.success('Address lookup completed', { id: toastId });
      onCheckComplete?.();
    } catch (err: unknown) {
      setAddressResult({
        success: false,
        error: err instanceof Error ? err.message : 'Network error',
      });
      toast.error(err instanceof Error ? err.message : 'Network error', { id: toastId });
    } finally {
      setIsAddressLoading(false);
    }
  };

  // Extract addresses from the response
  const extractAddresses = (data: Record<string, unknown> | undefined): AddressEntry[] => {
    if (!data) return [];
    if (Array.isArray(data.addresses)) return data.addresses;
    if (data.bestKnownAddress) return [data.bestKnownAddress as AddressEntry];
    // Try to find any array that looks like addresses
    for (const value of Object.values(data)) {
      if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'object') {
        const first = value[0] as Record<string, unknown>;
        if (first.line1 || first.suburb || first.city || first.postalCode) {
          return value as AddressEntry[];
        }
      }
    }
    return [];
  };

  const addresses = extractAddresses(addressResult?.data);

  return (
    <div className="space-y-4">
      {/* Design CM-K-Address: identification with the lookup action, then the addresses. */}
      <ClientIdentificationCard
        idNumber={idNumber}
        passport={passport}
        matterId={addressResult?.matterId ?? null}
        aside={
          <Button
            size="sm"
            onClick={handleAddressLookup}
            disabled={isAddressLoading || !hasIdentification}
          >
            {isAddressLoading && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            )}
            Run address lookup
          </Button>
        }
      />

      {!hasIdentification && (
        <Notice kind="attention" title="No ID or passport number on file.">
          It is needed for the address lookup.
        </Notice>
      )}

      {addressResult && (
        <PanelCard
          title={addressResult.success ? 'Address lookup complete' : 'Address lookup'}
          aside={
            addressResult.success ? (
              <button
                type="button"
                onClick={() => setShowRawAddress(!showRawAddress)}
                className="text-xs font-medium text-nw-text-2 hover:text-nw-ink"
              >
                {showRawAddress ? 'Hide' : 'Show'} raw response
              </button>
            ) : (
              <StatusPill tone="bad">Lookup failed</StatusPill>
            )
          }
        >
          {!addressResult.success ? (
            <p className="text-sm text-red-700">{addressResult.error}</p>
          ) : (
            <div className="space-y-3">
              {addresses.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-nw-bg text-left text-xs font-medium text-nw-text-3">
                        <th scope="col" className="px-3 py-2.5">
                          Address
                        </th>
                        <th scope="col" className="px-3 py-2.5">
                          Source
                        </th>
                        <th scope="col" className="px-3 py-2.5">
                          Last reported
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {addresses.map((addr, idx) => (
                        <tr key={idx} className="border-t border-nw-line">
                          <td className="px-3 py-3 text-nw-ink">
                            {[
                              addr.line1,
                              addr.line2,
                              addr.suburb,
                              addr.city,
                              addr.province,
                              addr.postalCode,
                              addr.country,
                            ]
                              .filter(Boolean)
                              .join(', ')}
                          </td>
                          <td className="px-3 py-3 text-nw-text-2">{addr.source || '—'}</td>
                          <td className="px-3 py-3 whitespace-nowrap text-nw-text-2">
                            {addr.lastReported
                              ? new Date(addr.lastReported).toLocaleDateString('en-ZA', {
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-nw-text-3">
                  The bureau returned no structured addresses. The raw response has the details.
                </p>
              )}
              {showRawAddress && (
                <pre className="max-h-48 overflow-auto rounded bg-gray-900 p-2 font-mono text-xs text-gray-100">
                  {JSON.stringify(addressResult.data, null, 2)}
                </pre>
              )}
            </div>
          )}
        </PanelCard>
      )}
    </div>
  );
}
