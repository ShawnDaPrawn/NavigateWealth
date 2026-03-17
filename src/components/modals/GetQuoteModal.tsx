import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Slider } from '../ui/slider';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import {
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Info,
  User,
  Shield,
  Phone,
  Mail,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner@2.0.3';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

interface Provider {
  id: string;
  name: string;
  logo: string;
}

interface GetQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  productName?: string;
  providers?: Provider[];
  coverageMin?: number;
  coverageMax?: number;
  coverageStep?: number;
  defaultCoverage?: number;
  coverageLabel?: string;
  coverageUnit?: string;
}

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  coverage: number;
  preferredProvider: string;
}

export function GetQuoteModal({
  isOpen,
  onClose,
  productName = "Financial Protection",
  providers = [],
  coverageMin = 250000,
  coverageMax = 10000000,
  coverageStep = 50000,
  defaultCoverage = 1000000,
  coverageLabel = "Coverage Amount",
  coverageUnit = "R"
}: GetQuoteModalProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    coverage: defaultCoverage,
    preferredProvider: ''
  });
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Honeypot (anti-bot) — hidden field, must stay empty
  const [honeypotWebsite, setHoneypotWebsite] = useState('');

  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount).replace('ZAR', coverageUnit);
  };

  const validateStep = (step: number): boolean => {
    const newErrors: Partial<FormData> = {};

    if (step === 1) {
      if (!formData.firstName.trim()) newErrors.firstName = 'First name is required';
      if (!formData.lastName.trim()) newErrors.lastName = 'Last name is required';
      if (!formData.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
        newErrors.email = 'Email is invalid';
      }
      if (!formData.phone.trim()) {
        newErrors.phone = 'Phone number is required';
      } else if (!/^[\d\s\-+()]{7,}$/.test(formData.phone)) {
        newErrors.phone = 'Phone number must contain at least 7 digits';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, totalSteps));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      const providerName =
        formData.preferredProvider === 'no-preference'
          ? 'No Preference'
          : providers.find((p) => p.id === formData.preferredProvider)?.name || formData.preferredProvider;

      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/quote-request/submit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({
            firstName: formData.firstName.trim(),
            lastName: formData.lastName.trim(),
            email: formData.email.trim(),
            phone: formData.phone.trim(),
            productName,
            coverage: formData.coverage,
            preferredProvider: providerName,
            website: honeypotWebsite,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('Quote request submission error:', result);
        toast.error(result.error || 'Something went wrong. Please try again.');
        return;
      }

      setCurrentStep(totalSteps);
    } catch (error) {
      console.error('Quote request network error:', error);
      toast.error('Unable to submit your request. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      coverage: defaultCoverage,
      preferredProvider: ''
    });
    setErrors({});
    onClose();
  };

  const handleFinish = () => {
    handleClose();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-black mb-2">Your Information</h3>
              <p className="text-gray-600">Let's start with some basic details about you.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                  className={errors.firstName ? 'border-red-500' : ''}
                  placeholder="Enter your first name"
                />
                {errors.firstName && (
                  <p className="text-red-500 text-sm">{errors.firstName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                  className={errors.lastName ? 'border-red-500' : ''}
                  placeholder="Enter your last name"
                />
                {errors.lastName && (
                  <p className="text-red-500 text-sm">{errors.lastName}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                className={errors.email ? 'border-red-500' : ''}
                placeholder="Enter your email address"
              />
              {errors.email && (
                <p className="text-red-500 text-sm">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                className={errors.phone ? 'border-red-500' : ''}
                placeholder="Enter your phone number"
              />
              {errors.phone && (
                <p className="text-red-500 text-sm">{errors.phone}</p>
              )}
            </div>

            {/* Honeypot — hidden from real users, traps bots */}
            <div className="absolute opacity-0 h-0 overflow-hidden" aria-hidden="true" tabIndex={-1}>
              <label htmlFor="modal-website">Website</label>
              <input
                id="modal-website"
                name="website"
                type="text"
                autoComplete="off"
                value={honeypotWebsite}
                onChange={(e) => setHoneypotWebsite(e.target.value)}
                tabIndex={-1}
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-black mb-2">Choose Coverage</h3>
              <p className="text-gray-600">Select the coverage amount that best suits your needs.</p>
            </div>

            <div className="space-y-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">
                  {formatCurrency(formData.coverage)}
                </div>
                <p className="text-gray-600 text-sm">{coverageLabel}</p>
              </div>

              <div className="px-4">
                <Slider
                  value={[formData.coverage]}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, coverage: value[0] }))}
                  max={coverageMax}
                  min={coverageMin}
                  step={coverageStep}
                  className="w-full"
                />
                <div className="flex justify-between text-sm text-gray-500 mt-2">
                  <span>{formatCurrency(coverageMin)}</span>
                  <span>{formatCurrency(coverageMax)}</span>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Info className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-blue-800 text-sm">
                      We'll recommend the most suitable amount based on your needs and circumstances during your consultation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-black mb-2">Preferred Provider</h3>
              <p className="text-gray-600">Choose your preferred insurance provider or let us recommend one.</p>
            </div>

            <RadioGroup
              value={formData.preferredProvider}
              onValueChange={(value) => setFormData(prev => ({ ...prev, preferredProvider: value }))}
              className="space-y-4"
            >
              <div className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                <RadioGroupItem value="no-preference" id="no-preference" />
                <Label htmlFor="no-preference" className="flex-1 cursor-pointer">
                  <div className="font-medium">No Preference</div>
                  <div className="text-sm text-gray-600">Let our advisers recommend the best option for you</div>
                </Label>
              </div>

              {providers.map((provider) => (
                <div key={provider.id} className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <RadioGroupItem value={provider.id} id={provider.id} />
                  <Label htmlFor={provider.id} className="flex-1 cursor-pointer flex items-center space-x-3">
                    <ImageWithFallback
                      src={provider.logo}
                      alt={provider.name}
                      className="w-8 h-8 object-contain"
                    />
                    <div className="font-medium">{provider.name}</div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>

            <div className="space-y-4">
              <h3 className="text-2xl font-semibold text-black">Thank You!</h3>
              <p className="text-gray-600 leading-relaxed">
                Thank you for requesting a quote for {productName}. One of our licensed advisers will review 
                your request and contact you shortly with options and pricing.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <h4 className="font-semibold text-black">What happens next?</h4>
              <div className="space-y-3 text-sm text-gray-600">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-medium text-purple-600">1</div>
                  <span>Our team reviews your quote request within 24 hours</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-medium text-purple-600">2</div>
                  <span>A licensed adviser will contact you to discuss options</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center text-xs font-medium text-purple-600">3</div>
                  <span>Receive personalized quotes and recommendations</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                size="lg" 
                className="bg-purple-600 hover:bg-purple-700 text-white"
                onClick={handleFinish}
              >
                Create Account to Fast-Track
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={handleFinish}
              >
                Finish
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-0 top-0 p-2"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
          <DialogTitle className="text-left pr-8">
            Get a Quote - {productName}
          </DialogTitle>
          <DialogDescription className="text-left pr-8 text-gray-600">
            Complete this quick form to get a personalized quote from our licensed advisers.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-2 px-6">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>Step {currentStep} of {totalSteps}</span>
            <span>{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="w-full" />
        </div>

        <div className="py-4">
          {renderStep()}
        </div>

        {currentStep < totalSteps && (
          <div className="flex justify-between pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 1}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
            <Button
              onClick={currentStep === 3 ? handleSubmit : handleNext}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <div className="contents">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </div>
              ) : currentStep === 3 ? (
                <div className="contents">
                  Submit Request
                  <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              ) : (
                <div className="contents">
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </div>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}