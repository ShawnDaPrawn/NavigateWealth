/**
 * Presentation lookups for screening results: category labels/icons and the
 * outcome badge. One slice of the risk-assessment panel.
 */
import { Badge } from '../../../../../ui/badge';
import {
  AlertTriangle,
  BarChart3,
  Users,
  UserCheck,
  Scale,
  Newspaper,
  Landmark,
  Ban,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';

// ─── Screening result helpers ────────────────────────────────────────────────

export const getScreeningCategoryInfo = (key: string) => {
  const map: Record<
    string,
    { label: string; icon: React.ReactNode; category: 'person' | 'company' }
  > = {
    possiblePepsNaturalPerson: {
      label: 'PEPs',
      icon: <Users className="h-4 w-4" />,
      category: 'person',
    },
    possibleRepsNaturalPerson: {
      label: 'REPs',
      icon: <UserCheck className="h-4 w-4" />,
      category: 'person',
    },
    possibleGazetteItemsNaturalPerson: {
      label: 'Gazette Items',
      icon: <Newspaper className="h-4 w-4" />,
      category: 'person',
    },
    possibleSanctionsNaturalPerson: {
      label: 'Sanctions',
      icon: <Ban className="h-4 w-4" />,
      category: 'person',
    },
    possibleAdverseMediaNaturalPerson: {
      label: 'Adverse Media',
      icon: <AlertTriangle className="h-4 w-4" />,
      category: 'person',
    },
    possibleLandClaimNaturalPerson: {
      label: 'Land Claims',
      icon: <Landmark className="h-4 w-4" />,
      category: 'person',
    },
    possibleAssetForfeitureNaturalPerson: {
      label: 'Asset Forfeiture',
      icon: <Scale className="h-4 w-4" />,
      category: 'person',
    },
    possiblePepsCompany: {
      label: 'PEPs',
      icon: <Users className="h-4 w-4" />,
      category: 'company',
    },
    possibleRepsCompany: {
      label: 'REPs',
      icon: <UserCheck className="h-4 w-4" />,
      category: 'company',
    },
    possibleGazetteItemsCompany: {
      label: 'Gazette Items',
      icon: <Newspaper className="h-4 w-4" />,
      category: 'company',
    },
    possibleSanctionsCompany: {
      label: 'Sanctions',
      icon: <Ban className="h-4 w-4" />,
      category: 'company',
    },
    possibleAdverseMediaCompany: {
      label: 'Adverse Media',
      icon: <AlertTriangle className="h-4 w-4" />,
      category: 'company',
    },
    possibleLandClaimCompany: {
      label: 'Land Claims',
      icon: <Landmark className="h-4 w-4" />,
      category: 'company',
    },
    possibleAssetForfeitureCompany: {
      label: 'Asset Forfeiture',
      icon: <Scale className="h-4 w-4" />,
      category: 'company',
    },
  };
  return map[key] || null;
};

export const getOutcomeBadge = (outcome: string | null) => {
  if (!outcome)
    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-600 border-gray-200">
        Pending
      </Badge>
    );
  const lower = outcome.toLowerCase();
  if (lower.includes('clear') || lower.includes('pass') || lower.includes('low')) {
    return (
      <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
        <ShieldCheck className="h-3 w-3 mr-1" />
        {outcome}
      </Badge>
    );
  }
  if (lower.includes('high') || lower.includes('fail') || lower.includes('reject')) {
    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
        <ShieldAlert className="h-3 w-3 mr-1" />
        {outcome}
      </Badge>
    );
  }
  if (lower.includes('medium') || lower.includes('review') || lower.includes('warn')) {
    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
        <AlertTriangle className="h-3 w-3 mr-1" />
        {outcome}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
      <BarChart3 className="h-3 w-3 mr-1" />
      {outcome}
    </Badge>
  );
};

// ─── Component ───────────────────────────────────────────────────────────────
