/**
 * DynamicServicePageWrapper
 * Fetches schema + policies from the integrations API, builds columns
 * dynamically, and delegates to ServicePageLayout.
 *
 * Supports multi-table layouts for categories with sub-categories
 * (e.g., retirement_pre/post, investments_voluntary/guaranteed).
 *
 * Guidelines refs: §4.2 (thin dispatcher), §5.1 (API boundary), §8.4 (AI builder)
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  ServicePageLayout,
  type Column,
  type ServicePageAction,
  type ServicePageInsight,
  type TableSection,
} from './ServicePageLayout';
import { PolicyDetailModal } from '../modals/PolicyDetailModal';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { formatCurrency } from '../../utils/currencyFormatter';
import { Loader2 } from 'lucide-react';
import { DEFAULT_SCHEMAS } from '../admin/modules/product-management/defaults';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/integrations`;

/** Sub-category table definition for multi-table products */
export interface SubCategoryConfig {
  categoryId: string;
  title: string;
  subtitle?: string;
  emptyMessage?: string;
}

interface DynamicServicePageWrapperProps {
  /** Primary category ID used for API fetch (e.g. 'retirement_planning', 'investments') */
  categoryId: string;
  title: string;
  description: string;
  icon: React.ElementType;
  themeColor: 'purple' | 'blue' | 'green' | 'red' | 'orange' | 'indigo';
  quickActions: ServicePageAction[];
  insights: ServicePageInsight[];
  backPath?: string;
  /**
   * Optional sub-category configuration for multi-table layout.
   * When provided, policies are split into separate tables by sub-categoryId,
   * each with its own schema.
   */
  subCategories?: SubCategoryConfig[];
}

interface SchemaField {
  id: string;
  name: string;
  type: string;
  [key: string]: unknown;
}

type PolicyRecord = Record<string, unknown> & {
  id?: string;
  categoryId?: string;
  providerName?: string;
  data?: Record<string, unknown>;
  archived?: boolean;
};

export function DynamicServicePageWrapper({
  categoryId,
  title,
  description,
  icon,
  themeColor,
  quickActions,
  insights,
  backPath,
  subCategories,
}: DynamicServicePageWrapperProps) {
  const { user } = useAuth();
  // Map of categoryId → schema fields
  const [schemas, setSchemas] = useState<Record<string, SchemaField[]>>({});
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPolicy, setSelectedPolicy] = useState<PolicyRecord | null>(null);
  const [showPolicyModal, setShowPolicyModal] = useState(false);

  // Determine which category IDs we need schemas for
  const allCategoryIds = useMemo(() => {
    if (subCategories && subCategories.length > 0) {
      return subCategories.map((sc) => sc.categoryId);
    }
    return [categoryId];
  }, [categoryId, subCategories]);

  useEffect(() => {
    if (user?.id) fetchData();
  }, [user?.id, categoryId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1. Fetch schemas for all relevant category IDs in parallel
      const schemaPromises = allCategoryIds.map(async (catId) => {
        let fields: SchemaField[] = [];
        try {
          const res = await fetch(`${API_BASE}/schemas?categoryId=${catId}`, {
            headers: { Authorization: `Bearer ${publicAnonKey}` },
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.fields) fields = data.fields;
          }
        } catch (e) {
          console.error(`Error fetching schema for ${catId}:`, e);
        }

        // Fallback to defaults
        if (fields.length === 0) {
          const def = DEFAULT_SCHEMAS.find((s) => s.categoryId === catId);
          fields = def ? (def.fields as SchemaField[]) : [];
        }
        return { catId, fields };
      });

      const schemaResults = await Promise.all(schemaPromises);
      const schemaMap: Record<string, SchemaField[]> = {};
      for (const { catId, fields } of schemaResults) {
        schemaMap[catId] = fields;
      }
      setSchemas(schemaMap);

      // 2. Fetch policies (single call — API already expands sub-categories)
      try {
        const res = await fetch(
          `${API_BASE}/policies?clientId=${user?.id}&categoryId=${categoryId}`,
          { headers: { Authorization: `Bearer ${publicAnonKey}` } },
        );
        if (res.ok) {
          const data = await res.json();
          setPolicies(data.policies || []);
        }
      } catch (e) {
        console.error('Error fetching policies:', e);
      }
    } catch (err) {
      console.error('Error loading page data:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Helpers ──────────────────────────────────────────────────────────

  const formatValue = (type: string, value: unknown) => {
    if (value === null || value === undefined || value === '') return '-';
    switch (type) {
      case 'currency':
        return formatCurrency(Number(value));
      case 'percentage':
        return `${value}%`;
      case 'date':
      case 'date_inception':
        try {
          return new Date(String(value)).toLocaleDateString('en-ZA', {
            day: '2-digit', month: 'short', year: 'numeric',
          });
        } catch {
          return String(value);
        }
      case 'boolean':
        return value ? 'Yes' : 'No';
      default:
        return String(value);
    }
  };

  const getProviderStyle = (providerName: string) => {
    const n = (providerName || '').toLowerCase();
    if (n.includes('discovery')) return { color: '#EC008C', bg: '#FFF0F8' };
    if (n.includes('liberty')) return { color: '#003DA5', bg: '#E6F0FF' };
    if (n.includes('old mutual')) return { color: '#006C44', bg: '#E6F5EF' };
    if (n.includes('sanlam')) return { color: '#0074C9', bg: '#F0F7FC' };
    if (n.includes('momentum')) return { color: '#C61E4A', bg: '#FDF2F5' };
    if (n.includes('brightrock')) return { color: '#FF6B00', bg: '#FFF3E6' };
    if (n.includes('allan gray')) return { color: '#666666', bg: '#F5F5F5' };
    return { color: '#6d28d9', bg: '#F5F0FF' };
  };

  /** Build columns for a given schema */
  const buildColumns = (schema: SchemaField[]): Column<PolicyRecord>[] => [
    {
      header: 'Provider',
      render: (item) => {
        const style = getProviderStyle(String(item.providerName || ''));
        return (
          <div className="flex items-center gap-2.5">
            <div
              className="h-7 w-7 rounded-md flex items-center justify-center border text-[10px] font-bold"
              style={{ borderColor: style.color + '30', backgroundColor: style.bg, color: style.color }}
            >
              {(String(item.providerName || '??')).substring(0, 2).toUpperCase()}
            </div>
            <span className="font-medium text-gray-900 text-sm">
              {String(item.providerName || 'Unknown Provider')}
            </span>
          </div>
        );
      },
    },
    ...schema.map((field) => ({
      header: field.name,
      render: (item: PolicyRecord) => {
        const val = item.data ? (item.data as Record<string, unknown>)[field.id] : null;
        const isCurrency = field.type === 'currency';
        const isPolicy =
          field.id.endsWith('_1') ||
          field.name.toLowerCase().includes('policy') ||
          field.name.toLowerCase().includes('number');
        return (
          <span
            className={`text-sm ${isCurrency ? 'font-medium text-gray-900 tabular-nums' : 'text-gray-600'} ${
              isPolicy ? 'font-mono text-xs' : ''
            }`}
          >
            {formatValue(field.type, val)}
          </span>
        );
      },
    })),
  ];

  // ── Determine schema for the selected policy in the modal ──

  const getSchemaForPolicy = (policy: PolicyRecord): SchemaField[] => {
    if (policy.categoryId && schemas[policy.categoryId]) {
      return schemas[policy.categoryId];
    }
    // Fallback: use first available schema
    const firstKey = Object.keys(schemas)[0];
    return firstKey ? schemas[firstKey] : [];
  };

  // ── Loading State ──

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading {title}...</p>
        </div>
      </div>
    );
  }

  // ── Build table sections ──

  let tableSections: TableSection<PolicyRecord>[] | undefined;

  if (subCategories && subCategories.length > 0) {
    tableSections = subCategories.map((sc) => {
      const sectionPolicies = policies.filter((p) => p.categoryId === sc.categoryId);
      const sectionSchema = schemas[sc.categoryId] || [];
      return {
        id: sc.categoryId,
        title: sc.title,
        subtitle: sc.subtitle,
        emptyMessage: sc.emptyMessage || `No ${sc.title.toLowerCase()} policies found.`,
        data: sectionPolicies,
        columns: buildColumns(sectionSchema),
      };
    });
  }

  // For single-table products, also check for un-sub-categorised policies
  const singleTableData = subCategories ? undefined : policies;
  const singleTableColumns = subCategories
    ? undefined
    : buildColumns(schemas[categoryId] || schemas[Object.keys(schemas)[0]] || []);

  return (
    <div className="contents">
      <ServicePageLayout
        title={title}
        description={description}
        icon={icon}
        themeColor={themeColor}
        data={singleTableData}
        columns={singleTableColumns}
        tableSections={tableSections}
        quickActions={quickActions}
        insights={insights}
        backPath={backPath}
        onRowClick={(policy) => {
          setSelectedPolicy(policy);
          setShowPolicyModal(true);
        }}
      />

      {/* Policy Detail Modal */}
      {showPolicyModal && selectedPolicy && (
        <PolicyDetailModal
          isOpen={showPolicyModal}
          onClose={() => {
            setShowPolicyModal(false);
            setSelectedPolicy(null);
          }}
          providerName={String(selectedPolicy.providerName || 'Unknown Provider')}
          categoryName={title}
          fields={getSchemaForPolicy(selectedPolicy).map((field) => ({
            id: field.id,
            name: field.name,
            type: field.type,
            value: selectedPolicy.data
              ? (selectedPolicy.data as Record<string, unknown>)[field.id]
              : null,
          }))}
          themeColor={themeColor}
          policyRecord={selectedPolicy}
        />
      )}
    </div>
  );
}