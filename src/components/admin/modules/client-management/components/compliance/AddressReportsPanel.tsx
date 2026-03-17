/**
 * Address Panel
 *
 * Phase 2 endpoint:
 * - Best Known Address: POST /natural-person-address
 *
 * Retrieves the client's best known address from credit bureau records.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../../ui/card';
import { Badge } from '../../../../../ui/badge';
import { Button } from '../../../../../ui/button';
import {
  MapPin,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Home,
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId } from '../../../../../../utils/supabase/info';
import { getAuthToken } from './compliance-auth';

interface AddressReportsPanelProps {
  clientId: string;
  firstName: string;
  lastName: string;
  idNumber: string | null;
  passport: string | null;
  hasIdentification: boolean;
  onCheckComplete?: () => void;
}

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations/honeycomb`;

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
      const res = await fetch(`${API_BASE}/address/best-known`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await getAuthToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ clientId, firstName, lastName, idNumber, passport }),
      });

      const data = await res.json();

      if (!res.ok) {
        const errMsg = typeof data?.error === 'string' ? data.error : JSON.stringify(data?.error);
        setAddressResult({ success: false, error: errMsg });
        toast.error(errMsg, { id: toastId });
        return;
      }

      setAddressResult({ success: true, data: data.data, matterId: data.matterId });
      toast.success('Address lookup completed', { id: toastId });
      onCheckComplete?.();
    } catch (err: unknown) {
      setAddressResult({ success: false, error: err instanceof Error ? err.message : 'Network error' });
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
      {/* Best Known Address */}
      <Card className="bg-green-50/50 border-green-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-md font-medium flex items-center gap-2">
            <MapPin className="h-5 w-5 text-green-600" />
            Best Known Address
          </CardTitle>
          <CardDescription>
            Retrieve the client's known addresses from credit bureau records.
            This creates a matter and queries address data linked to their ID number.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!hasIdentification && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">Client ID/passport required for address lookup.</p>
            </div>
          )}

          <Button
            className="w-full"
            variant="secondary"
            onClick={handleAddressLookup}
            disabled={isAddressLoading || !hasIdentification}
          >
            {isAddressLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Home className="mr-2 h-4 w-4" />
            Look Up Address
          </Button>

          {/* Address results */}
          {addressResult && (
            <div className={`rounded-lg p-3 text-sm ${
              addressResult.success
                ? 'bg-green-50 border border-green-200'
                : 'bg-red-50 border border-red-200'
            }`}>
              {!addressResult.success && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="text-red-800 font-medium">Lookup Failed</span>
                  <p className="text-red-700 text-xs mt-1">{addressResult.error}</p>
                </div>
              )}

              {addressResult.success && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-green-800 font-medium">Address Lookup Complete</span>
                  </div>

                  {addressResult.matterId && (
                    <div className="flex items-center gap-1 text-xs text-gray-600 mb-3">
                      <span>Matter ID:</span>
                      <Badge variant="outline" className="font-mono text-xs">{addressResult.matterId}</Badge>
                    </div>
                  )}

                  {/* Render addresses if found */}
                  {addresses.length > 0 ? (
                    <div className="space-y-2">
                      {addresses.map((addr, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="text-sm">
                              {addr.line1 && <div>{addr.line1}</div>}
                              {addr.line2 && <div>{addr.line2}</div>}
                              <div>
                                {[addr.suburb, addr.city, addr.province].filter(Boolean).join(', ')}
                              </div>
                              {addr.postalCode && <div>{addr.postalCode}</div>}
                              {addr.country && <div className="text-gray-500">{addr.country}</div>}
                              {addr.source && (
                                <Badge variant="outline" className="mt-1 text-xs">{addr.source}</Badge>
                              )}
                              {addr.lastReported && (
                                <span className="text-xs text-gray-400 ml-2">
                                  Last reported: {new Date(addr.lastReported).toLocaleDateString('en-ZA')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">
                      No structured address data returned. Check the raw response for details.
                    </p>
                  )}

                  {/* Toggle raw response */}
                  <button
                    onClick={() => setShowRawAddress(!showRawAddress)}
                    className="flex items-center gap-1 mt-2 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {showRawAddress ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    {showRawAddress ? 'Hide' : 'Show'} full response
                  </button>

                  {showRawAddress && (
                    <pre className="mt-2 p-2 bg-gray-900 text-gray-100 text-xs rounded overflow-auto max-h-48 font-mono">
                      {JSON.stringify(addressResult.data, null, 2)}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}