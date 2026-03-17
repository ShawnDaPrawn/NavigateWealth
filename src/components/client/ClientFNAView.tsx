/**
 * Client-Side Read-Only FNA View
 * Displays published FNA results to clients in a read-only format
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Shield,
  Heart,
  Users,
  Home,
  TrendingUp,
  DollarSign,
  Calendar,
  AlertCircle,
  CheckCircle,
  Loader2,
  FileText,
  Download,
  Phone,
} from 'lucide-react';
import { getFNA, AnyFNA, formatDate, timeAgo, RiskPlanningFNA, MedicalFNA, RetirementFNA, InvestmentINA, TaxPlanningFNA, EstatePlanningFNA } from '../../services/fna-api';
import { RiskPlanningResults } from './fna-results/RiskPlanningResults';
import { MedicalResults } from './fna-results/MedicalResults';
import { RetirementResults } from './fna-results/RetirementResults';
import { InvestmentResults } from './fna-results/InvestmentResults';
import { TaxPlanningResults } from './fna-results/TaxPlanningResults';
import { EstatePlanningResults } from './fna-results/EstatePlanningResults';

interface ClientFNAViewProps {
  clientId: string;
  fnaType: 'risk' | 'medical' | 'retirement' | 'investment' | 'tax' | 'estate';
}

export function ClientFNAView({ clientId, fnaType }: ClientFNAViewProps) {
  const [loading, setLoading] = useState(true);
  const [fnaData, setFnaData] = useState<AnyFNA | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchFNA() {
      if (!clientId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const data = await getFNA(clientId, fnaType);
        
        setFnaData(data);
      } catch (err) {
        console.error('Error fetching FNA:', err);
        setError(err instanceof Error ? err.message : 'Failed to load FNA data');
      } finally {
        setLoading(false);
      }
    }

    fetchFNA();
  }, [clientId, fnaType]);

  const getFNATypeConfig = () => {
    const configs = {
      risk: {
        title: 'Risk Planning Analysis',
        icon: Shield,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        description: 'Comprehensive risk and life insurance needs assessment',
      },
      medical: {
        title: 'Medical Needs Analysis',
        icon: Heart,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        description: 'Medical aid scheme analysis and recommendations',
      },
      retirement: {
        title: 'Retirement Planning Analysis',
        icon: TrendingUp,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        description: 'Retirement income projection and planning',
      },
      investment: {
        title: 'Investment Needs Analysis',
        icon: DollarSign,
        color: 'text-purple-600',
        bgColor: 'bg-purple-50',
        borderColor: 'border-purple-200',
        description: 'Goal-based investment strategy and recommendations',
      },
      tax: {
        title: 'Tax Planning Analysis',
        icon: FileText,
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
        description: 'Tax exposure analysis and optimization strategies',
      },
      estate: {
        title: 'Estate Planning Analysis',
        icon: Home,
        color: 'text-indigo-600',
        bgColor: 'bg-indigo-50',
        borderColor: 'border-indigo-200',
        description: 'Estate planning and death estate modeling',
      },
    };
    
    return configs[fnaType];
  };

  const config = getFNATypeConfig();
  const Icon = config.icon;

  if (loading) {
    return (
      <div className="py-12 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#6d28d9] mx-auto mb-3" />
          <p className="text-sm text-gray-600">Loading your analysis...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        {/* Info Banner */}
        <Card className={`${config.borderColor} ${config.bgColor} border-2`}>
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg bg-white`}>
                <Icon className={`h-8 w-8 ${config.color}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-gray-900 mb-2">{config.title}</h3>
                <p className="text-sm text-gray-700 mb-4">
                  {config.description}
                </p>
                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-900 mb-1">
                      Error loading analysis
                    </p>
                    <p className="text-xs text-gray-600">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Card */}
        <Card className="border-gray-200">
          <CardContent className="py-6">
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <Phone className="h-6 w-6 text-[#6d28d9]" />
              </div>
              <h4 className="text-gray-900 mb-2">
                Schedule Your Financial Needs Analysis
              </h4>
              <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                Get personalized insights and recommendations from your dedicated financial adviser. 
                A comprehensive {config.title.toLowerCase()} typically takes 30-45 minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  variant="outline" 
                  className="border-[#6d28d9] text-[#6d28d9] hover:bg-purple-50"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call (+27) 12-667-2505
                </Button>
                <Button className="bg-gradient-to-r from-[#6d28d9] to-[#5b21b6] hover:from-[#5b21b6] hover:to-[#6d28d9] text-white shadow-md shadow-purple-500/20">
                  <Calendar className="h-4 w-4 mr-2" />
                  Book Consultation
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Section */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="mb-2">
                  <strong>What to expect:</strong>
                </p>
                <ul className="space-y-1 text-xs">
                  <li>• Comprehensive analysis of your financial situation and goals</li>
                  <li>• Personalized recommendations tailored to your needs</li>
                  <li>• Clear action plan with next steps</li>
                  <li>• Ongoing review and updates as your circumstances change</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!fnaData) {
    return (
      <div className="space-y-4">
        {/* Info Banner */}
        <Card className={`${config.borderColor} ${config.bgColor} border-2`}>
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg bg-white`}>
                <Icon className={`h-8 w-8 ${config.color}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-gray-900 mb-2">{config.title}</h3>
                <p className="text-sm text-gray-700 mb-4">
                  {config.description}
                </p>
                <div className="flex items-start gap-3 p-3 bg-white rounded-lg border border-gray-200">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-gray-900 mb-1">
                      No analysis available yet
                    </p>
                    <p className="text-xs text-gray-600">
                      Your financial adviser has not yet completed a {config.title.toLowerCase()} for your profile. 
                      Contact them to schedule a comprehensive financial needs analysis.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Card */}
        <Card className="border-gray-200">
          <CardContent className="py-6">
            <div className="text-center">
              <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
                <Phone className="h-6 w-6 text-[#6d28d9]" />
              </div>
              <h4 className="text-gray-900 mb-2">
                Schedule Your Financial Needs Analysis
              </h4>
              <p className="text-sm text-gray-600 mb-6 max-w-md mx-auto">
                Get personalized insights and recommendations from your dedicated financial adviser. 
                A comprehensive {config.title.toLowerCase()} typically takes 30-45 minutes.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button 
                  variant="outline" 
                  className="border-[#6d28d9] text-[#6d28d9] hover:bg-purple-50"
                >
                  <Phone className="h-4 w-4 mr-2" />
                  Call (+27) 12-667-2505
                </Button>
                <Button className="bg-gradient-to-r from-[#6d28d9] to-[#5b21b6] hover:from-[#5b21b6] hover:to-[#6d28d9] text-white shadow-md shadow-purple-500/20">
                  <Calendar className="h-4 w-4 mr-2" />
                  Book Consultation
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Info Section */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="mb-2">
                  <strong>What to expect:</strong>
                </p>
                <ul className="space-y-1 text-xs">
                  <li>• Comprehensive analysis of your financial situation and goals</li>
                  <li>• Personalized recommendations tailored to your needs</li>
                  <li>• Clear action plan with next steps</li>
                  <li>• Ongoing review and updates as your circumstances change</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // FNA data exists - display the results
  return (
    <div className="space-y-6">
      {/* Published FNA Header */}
      <Card className="border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-600">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h4 className="text-gray-900">Published Analysis</h4>
                <p className="text-xs text-gray-600">
                  Published {fnaData.publishedAt && timeAgo(fnaData.publishedAt)} • 
                  Last updated {formatDate(fnaData.updatedAt)} • 
                  Version {fnaData.version}
                </p>
              </div>
            </div>
            <Badge className="bg-green-600 hover:bg-green-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              Published
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Render FNA Type-Specific Results */}
      {fnaType === 'risk' && <RiskPlanningResults fna={fnaData as RiskPlanningFNA} />}
      
      {fnaType === 'medical' && <MedicalResults fna={fnaData as MedicalFNA} />}
      
      {fnaType === 'retirement' && <RetirementResults fna={fnaData as RetirementFNA} />}
      
      {fnaType === 'investment' && <InvestmentResults fna={fnaData as InvestmentINA} />}
      
      {fnaType === 'tax' && <TaxPlanningResults fna={fnaData as TaxPlanningFNA} />}
      
      {fnaType === 'estate' && <EstatePlanningResults fna={fnaData as EstatePlanningFNA} />}

      {/* Contact Adviser Card */}
      <Card className="border-purple-200 bg-purple-50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Phone className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-purple-900 mb-3">
                <strong>Questions about your analysis?</strong>
              </p>
              <p className="text-xs text-purple-800 mb-4">
                Your financial adviser is available to discuss these recommendations and answer any questions you may have.
              </p>
              <div className="flex gap-2">
                <Button 
                  size="sm"
                  variant="outline" 
                  className="border-purple-600 text-purple-600 hover:bg-purple-100"
                >
                  <Phone className="h-3 w-3 mr-2" />
                  Call Adviser
                </Button>
                <Button 
                  size="sm"
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Calendar className="h-3 w-3 mr-2" />
                  Book Meeting
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}