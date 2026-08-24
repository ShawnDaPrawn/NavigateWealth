/**
 * One icon per compliance activity type.
 *
 * Kept apart from `complianceTypes.ts` because these are JSX values, and a
 * module holding markup cannot be a plain `.ts` file.
 */
import React from 'react';
import {
  Building2,
  Camera,
  ClipboardList,
  CreditCard,
  FileText,
  Gavel,
  Home,
  Landmark,
  MapPin,
  Scale,
  Search,
  Shield,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';

export const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  'IDV Report': <UserCheck className="h-5 w-5 text-blue-600" />,
  'IDV Report (Photo)': <Camera className="h-5 w-5 text-purple-600" />,
  'Bulk IDV': <Users className="h-5 w-5 text-indigo-600" />,
  'Bank Verification': <Landmark className="h-5 w-5 text-green-600" />,
  'Consumer Credit Check': <CreditCard className="h-5 w-5 text-blue-600" />,
  'Consumer Trace': <Search className="h-5 w-5 text-indigo-600" />,
  'Debt Review Enquiry': <FileText className="h-5 w-5 text-amber-600" />,
  'CIPC Search': <Building2 className="h-5 w-5 text-purple-600" />,
  'Director Enquiry': <Users className="h-5 w-5 text-purple-600" />,
  'Best Known Address': <MapPin className="h-5 w-5 text-emerald-600" />,
  'Custom Screening': <Shield className="h-5 w-5 text-blue-600" />,
  'Sanctions Search': <Shield className="h-5 w-5 text-purple-600" />,
  'Enforcement Actions Search': <Gavel className="h-5 w-5 text-red-600" />,
  'Legal A Listing Search': <Scale className="h-5 w-5 text-amber-600" />,
  'Lifestyle Audit': <Home className="h-5 w-5 text-purple-600" />,
  'Income Predictor': <TrendingUp className="h-5 w-5 text-green-600" />,
  'Tenders Blue Search': <ClipboardList className="h-5 w-5 text-blue-600" />,
  'Risk Assessment': <ClipboardList className="h-5 w-5 text-green-600" />,
  'Client Registration': <UserCheck className="h-5 w-5 text-purple-600" />,
};
