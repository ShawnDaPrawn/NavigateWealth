/**
 * WelcomeBanner.tsx
 *
 * Welcome Banner + Health Score Ring sub-components for the Client Overview Tab.
 * Extracted from ClientOverviewTab.tsx.
 */

import React from 'react';
import { Card, CardContent } from '../../../../../ui/card';
import { Button } from '../../../../../ui/button';
import { Badge } from '../../../../../ui/badge';
import { User, Briefcase, RefreshCw, Download, Loader2 } from 'lucide-react';
import { fmt, fmtDate } from '../clientOverviewUtils';
import { HealthScoreBreakdown } from './HealthScoreBreakdown';
import type { HealthSubScores } from '../../utils';
import type { Client, ProfileData } from '../../types';
import type { DashboardMode } from '../clientOverviewConstants';

// ── Health Score Ring ────────────────────────────────────────────────────

export function HealthScoreRing({
  score,
  label,
  color,
  stroke,
}: {
  score: number;
  label: string;
  color: string;
  stroke: string;
}) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const progress = (score / 100) * circumference;
  const remaining = circumference - progress;

  return (
    <div
      className="relative flex items-center justify-center"
      title={`Financial Health: ${score}%`}
    >
      <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
        {/* Background track */}
        <circle cx="50" cy="50" r={radius} fill="none" stroke="#f3f4f6" strokeWidth="8" />
        {/* Progress arc */}
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${progress} ${remaining}`}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-xl font-bold ${color}`}>{score}</span>
        <span className="text-[7px] text-gray-400 uppercase tracking-wide font-medium max-w-[56px] text-center leading-tight">
          {label}
        </span>
      </div>
    </div>
  );
}

// ── Welcome Banner ──────────────────────────────────────────────────────

export function WelcomeBanner({
  client,
  profile,
  age,
  healthScore,
  healthLabel,
  healthColor,
  healthStroke,
  subScores,
  totalPremiums,
  netWorth,
  totalAssets,
  totalLiabilities,
  portfolioValue,
  retirementValue,
  investmentValue,
  premiumToIncomeRatio,
  policyCount,
  onRefresh,
  onDownloadPDF,
  generatingPDF,
  mode = 'adviser',
}: {
  client: Client;
  profile: ProfileData | null;
  age: number | null;
  healthScore: number;
  healthLabel: string;
  healthColor: string;
  healthStroke: string;
  subScores: HealthSubScores;
  totalPremiums: number;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  portfolioValue: number;
  retirementValue: number;
  investmentValue: number;
  premiumToIncomeRatio: number | null;
  policyCount: number;
  onRefresh: () => void;
  onDownloadPDF: () => void;
  generatingPDF: boolean;
  mode?: DashboardMode;
}) {
  const p = profile;
  const isClientMode = mode === 'client';
  const firstName = p?.firstName || client.firstName;
  const fullName = isClientMode
    ? firstName
    : `${p?.title ? p.title + ' ' : ''}${firstName} ${p?.lastName || client.lastName}`;
  const knownAs =
    !isClientMode && client.preferredName && client.preferredName !== client.firstName
      ? `"${client.preferredName}"`
      : null;
  const employer = (p?.employers || [])[0]?.employerName || p?.selfEmployedCompanyName || undefined;

  return (
    <Card className="overflow-hidden print:shadow-none print:border">
      {/* Print-only header */}
      <div className="hidden print:block border-b-2 border-[#6d28d9] px-6 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#6d28d9]">Navigate Wealth</h1>
            <p className="text-sm text-gray-600">
              {isClientMode ? 'My Financial Summary' : 'Client Portfolio Summary'}
            </p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <p>
              Generated:{' '}
              {new Date().toLocaleDateString('en-ZA', {
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <p>Confidential</p>
          </div>
        </div>
      </div>

      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Left: Identity (compact) */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className="flex items-center justify-center h-14 w-14 rounded-full bg-[#6d28d9]/10 flex-shrink-0">
                <User className="h-7 w-7 text-[#6d28d9]" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl md:text-2xl font-bold text-gray-900 truncate">
                    {isClientMode ? `Welcome back, ${fullName}` : fullName}
                  </h2>
                  {knownAs && <span className="text-sm text-gray-400 italic">{knownAs}</span>}
                  {/* Status badge — adviser sees application status; client sees simplified */}
                  {!isClientMode && (
                    <Badge
                      variant={client.applicationStatus === 'approved' ? 'default' : 'secondary'}
                      className={`text-[10px] ${client.applicationStatus === 'approved' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                    >
                      {client.applicationStatus === 'approved'
                        ? 'Active'
                        : client.applicationStatus}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1.5 flex-wrap text-sm text-gray-500">
                  {age !== null && <span>{age} years old</span>}
                  {age !== null && <span className="text-gray-300">{'·'}</span>}
                  <span>
                    {isClientMode ? 'Member' : 'Client'} since {fmtDate(client.createdAt)}
                  </span>
                  {employer && (
                    <div className="contents">
                      <span className="text-gray-300">{'·'}</span>
                      <span className="flex items-center gap-1">
                        <Briefcase className="h-3 w-3" />
                        {employer}
                      </span>
                    </div>
                  )}
                </div>

                {/* Application number — adviser only */}
                {!isClientMode && client.applicationNumber && (
                  <p className="text-xs text-gray-400 mt-1">#{client.applicationNumber}</p>
                )}

                {/* Financial snapshot stats — merged from former snapshot cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 pt-4 border-t border-gray-100">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider leading-none">
                      {isClientMode ? 'My Net Worth' : 'Net Worth'}
                    </p>
                    <p className="text-base md:text-lg font-bold text-gray-900 mt-1">
                      {fmt(netWorth)}
                    </p>
                    <p className="text-xs text-gray-400 leading-tight truncate">
                      {fmt(totalAssets)} assets · {fmt(totalLiabilities)} debt
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider leading-none">
                      Premiums
                    </p>
                    <p className="text-base md:text-lg font-bold text-gray-900 mt-1">
                      {fmt(totalPremiums)}/m
                    </p>
                    <p className="text-xs text-gray-400 leading-tight truncate">
                      {policyCount} {policyCount === 1 ? 'policy' : 'policies'}
                      {premiumToIncomeRatio !== null
                        ? ` · ${premiumToIncomeRatio.toFixed(0)}% of income`
                        : ''}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider leading-none">
                      {isClientMode ? 'My Savings' : 'Portfolio'}
                    </p>
                    <p className="text-base md:text-lg font-bold text-gray-900 mt-1">
                      {fmt(portfolioValue)}
                    </p>
                    <p className="text-xs text-gray-400 leading-tight truncate">
                      Ret: {fmt(retirementValue)} · Inv: {fmt(investmentValue)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider leading-none">
                      Health Score
                    </p>
                    <p className="text-base md:text-lg font-bold text-gray-900 mt-1">
                      {healthScore}/100
                    </p>
                    <p className="text-xs text-gray-400 leading-tight truncate">{healthLabel}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Health Score + Sub-Scores + Actions */}
          <div className="flex items-start gap-5 flex-shrink-0">
            <div className="flex flex-col items-center gap-3">
              {/* Health Score Ring */}
              <HealthScoreRing
                score={healthScore}
                label={healthLabel}
                color={healthColor}
                stroke={healthStroke}
              />
              {/* Sub-Score Breakdown */}
              <div className="w-full sm:w-[220px]">
                <HealthScoreBreakdown subScores={subScores} mode={mode} />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-col gap-2 print:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={onRefresh}
                title="Refresh"
                className="h-8 w-8 p-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDownloadPDF}
                disabled={generatingPDF}
                className="h-8 w-8 p-0"
                title={isClientMode ? 'Download My Report' : 'Download PDF'}
              >
                {generatingPDF ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
