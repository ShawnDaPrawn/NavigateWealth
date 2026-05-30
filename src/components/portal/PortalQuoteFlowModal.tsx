import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Mail, Phone, User, X } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { ProviderStrip } from '../pages/quote/components/ProviderStrip';
import { getServiceConfig } from '../pages/quote/constants';
import type { QuoteServiceId } from '../pages/quote/types';
import { RiskQuoteWizard } from '../pages/quote/components/RiskQuoteWizard';
import { MedicalAidQuoteWizard } from '../pages/quote/components/MedicalAidQuoteWizard';
import { InvestmentQuoteWizard } from '../pages/quote/components/InvestmentQuoteWizard';
import { RetirementQuoteWizard } from '../pages/quote/components/RetirementQuoteWizard';
import { EmployeeBenefitsQuoteWizard } from '../pages/quote/components/EmployeeBenefitsQuoteWizard';
import { TaxPlanningQuoteWizard } from '../pages/quote/components/TaxPlanningQuoteWizard';
import { EstatePlanningQuoteWizard } from '../pages/quote/components/EstatePlanningQuoteWizard';

interface PortalQuoteFlowModalProps {
  isOpen: boolean;
  onClose: () => void;
  serviceId: QuoteServiceId | null;
  user?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  } | null;
}

function QuoteSuccessState({
  serviceLabel,
  onClose,
}: {
  serviceLabel: string;
  onClose: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center px-5 py-12 text-center sm:px-6 sm:py-16">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      </div>
      <h3 className="mt-6 text-xl font-semibold text-gray-900 sm:text-2xl">Quote request received</h3>
      <p className="mt-3 max-w-xl text-sm leading-6 text-gray-600 sm:text-sm">
        Your {serviceLabel.toLowerCase()} request is now with the Navigate Wealth team.
        An adviser will review it and come back to you with the next steps.
      </p>
      <div className="mt-8 flex w-full flex-wrap items-center justify-center gap-3">
        <Button onClick={onClose} className="w-full bg-[#6d28d9] text-white hover:bg-[#5b21b6] sm:w-auto">
          Close
        </Button>
      </div>
    </div>
  );
}

function renderServiceWizard(
  serviceId: QuoteServiceId,
  props: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    onSuccess: () => void;
    onExit: () => void;
  },
) {
  switch (serviceId) {
    case 'risk-management':
      return <RiskQuoteWizard {...props} />;
    case 'medical-aid':
      return <MedicalAidQuoteWizard {...props} />;
    case 'investment-management':
      return <InvestmentQuoteWizard {...props} />;
    case 'retirement-planning':
      return <RetirementQuoteWizard {...props} />;
    case 'employee-benefits':
      return <EmployeeBenefitsQuoteWizard {...props} />;
    case 'tax-planning':
      return <TaxPlanningQuoteWizard {...props} />;
    case 'estate-planning':
      return <EstatePlanningQuoteWizard {...props} />;
    default:
      return null;
  }
}

export function PortalQuoteFlowModal({
  isOpen,
  onClose,
  serviceId,
  user,
}: PortalQuoteFlowModalProps) {
  const serviceConfig = useMemo(
    () => (serviceId ? getServiceConfig(serviceId) : null),
    [serviceId],
  );

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setIsSuccess(false);
      return;
    }

    setFirstName(user?.firstName || '');
    setLastName(user?.lastName || '');
    setEmail(user?.email || '');
    setPhone('');
    setIsSuccess(false);
  }, [isOpen, serviceId, user?.email, user?.firstName, user?.lastName]);

  const contactValid = Boolean(
    firstName.trim() && lastName.trim() && email.trim() && phone.trim(),
  );

  if (!serviceConfig) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        hideCloseButton
        className="inset-0 max-h-[100dvh] w-full max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-0 bg-[#f8f9fb] p-0 shadow-2xl sm:inset-auto sm:top-[50%] sm:left-[50%] sm:max-h-[94vh] sm:w-[96vw] sm:max-w-[1400px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border"
      >
        <DialogTitle className="sr-only">{serviceConfig.label} quote flow</DialogTitle>
        <DialogDescription className="sr-only">
          Complete your quote request inside the client portal.
        </DialogDescription>

        <div className="flex min-h-[100dvh] flex-col sm:min-h-0 sm:max-h-[94vh]">
          <div className="sticky top-0 z-10 border-b border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-7 sm:py-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-purple-200 bg-purple-50 text-[11px] font-medium text-[#6d28d9]"
                  >
                    Client Portal Quote
                  </Badge>
                  <span className="text-xs font-medium uppercase tracking-[0.24em] text-gray-400">
                    {serviceConfig.shortLabel}
                  </span>
                </div>
                <h2 className="mt-2 text-xl font-semibold tracking-tight text-gray-900 sm:mt-3 sm:text-2xl">
                  {serviceConfig.label}
                </h2>
                <p className="mt-1.5 max-w-3xl text-sm leading-5 text-gray-600 sm:mt-2 sm:leading-6">
                  {serviceConfig.heroDescription}
                </p>
                {serviceConfig.topicChips?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
                    {serviceConfig.topicChips.map((chip) => (
                      <Badge
                        key={chip}
                        variant="secondary"
                        className="bg-gray-100 text-xs font-medium text-gray-700"
                      >
                        {chip}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-10 w-10 flex-shrink-0 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Close quote modal</span>
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 sm:py-5 lg:px-7 lg:py-6">
            {isSuccess ? (
              <QuoteSuccessState serviceLabel={serviceConfig.label} onClose={onClose} />
            ) : (
              <div className="space-y-4 sm:space-y-6">
                <div className="rounded-2xl border border-purple-100 bg-gradient-to-r from-white via-white to-purple-50/60 p-4 shadow-sm sm:rounded-3xl sm:p-5">
                  {serviceConfig.providers.length > 0 ? (
                    <ProviderStrip providers={serviceConfig.providers} className="mb-0" />
                  ) : (
                    <div>
                      <p className="text-xs font-medium text-gray-500">
                        This service is handled directly by the Navigate Wealth team.
                      </p>
                      <p className="mt-2 text-sm leading-6 text-gray-600">
                        Complete the guided questions below and we will route your request to the
                        right adviser without sending you out to the public website.
                      </p>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 lg:gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:rounded-3xl sm:p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50">
                          <User className="h-5 w-5 text-[#6d28d9]" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">Your details</h3>
                          <p className="mt-1 text-sm leading-5 text-gray-500 sm:leading-6">
                            We prefill what we know from your client profile. Please confirm the
                            best contact details for this quote.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 rounded-2xl bg-purple-50/80 px-3 py-2 text-xs leading-5 text-[#5b21b6] sm:hidden">
                        Add your phone number to unlock the full quote wizard below.
                      </div>

                      <div className="mt-4 space-y-4 sm:mt-5">
                        <div className="space-y-1.5">
                          <Label htmlFor="portal-quote-first-name">First name</Label>
                          <div className="relative">
                            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <Input
                              id="portal-quote-first-name"
                              value={firstName}
                              onChange={(e) => setFirstName(e.target.value)}
                              className="h-11 pl-9"
                              placeholder="First name"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="portal-quote-last-name">Surname</Label>
                          <Input
                            id="portal-quote-last-name"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="h-11"
                            placeholder="Surname"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="portal-quote-email">Email address</Label>
                          <div className="relative">
                            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <Input
                              id="portal-quote-email"
                              type="email"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              className="h-11 pl-9"
                              placeholder="name@example.com"
                            />
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="portal-quote-phone">Contact number</Label>
                          <div className="relative">
                            <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                            <Input
                              id="portal-quote-phone"
                              type="tel"
                              value={phone}
                              onChange={(e) => setPhone(e.target.value)}
                              className="h-11 pl-9"
                              placeholder="082 345 6789"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="hidden rounded-3xl border border-gray-200 bg-white p-5 shadow-sm lg:block">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
                        How this works
                      </p>
                      <div className="mt-4 space-y-3 text-sm leading-6 text-gray-600">
                        <p>1. Confirm your contact details.</p>
                        <p>2. Complete the service-specific quote questions.</p>
                        <p>3. Your adviser receives the request without leaving the portal flow.</p>
                      </div>
                    </div>
                  </div>

                  <div className="min-w-0">
                    {contactValid ? (
                      <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm sm:rounded-3xl sm:p-5">
                        {renderServiceWizard(serviceId as QuoteServiceId, {
                          firstName,
                          lastName,
                          email,
                          phone,
                          onSuccess: () => setIsSuccess(true),
                          onExit: onClose,
                        })}
                      </div>
                    ) : (
                      <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center shadow-sm sm:min-h-[320px] sm:rounded-3xl sm:p-8">
                        <div className="max-w-md">
                          <h3 className="text-lg font-semibold text-gray-900">
                            Confirm your details to begin
                          </h3>
                          <p className="mt-3 text-sm leading-6 text-gray-500">
                            Fill in your name, email address, and phone number on the left, then the
                            full {serviceConfig.shortLabel.toLowerCase()} quote wizard will open here.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
