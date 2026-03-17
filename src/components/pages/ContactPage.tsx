import React, { useState } from 'react';
import { SEO, createContactPageSchema } from '../seo/SEO';
import { getSEOData } from '../seo/seo-config';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { MapPin, Phone, Mail, Clock, Calendar, ArrowRight, MessageCircle, Users, CheckCircle, Headphones, Building, UserCheck, Briefcase, Loader2 } from 'lucide-react';
import { ThankYouModal } from '../modals/ThankYouModal';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { toast } from 'sonner@2.0.3';

export function ContactPage() {
  const [thankYouModalOpen, setThankYouModalOpen] = useState(false);
  const [activeClientType, setActiveClientType] = useState('individuals');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    investmentAmount: '',
    service: '',
    message: '',
    website: '',  // honeypot field — hidden from users, bots will fill it
  });

  // Get SEO data for contact page
  const seoData = getSEOData('contact');

  // Contact page structured data
  const contactPageStructuredData = createContactPageSchema();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Enhanced client-side validation
    if (!formData.firstName.trim() || !formData.lastName.trim() || !formData.email.trim() || !formData.phone.trim()) {
      toast.error('Please fill in all required fields.');
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email.trim())) {
      toast.error('Please enter a valid email address.');
      return;
    }

    // Phone format validation — at least 7 digits
    const phoneDigits = formData.phone.replace(/[^\d]/g, '');
    if (phoneDigits.length < 7) {
      toast.error('Please enter a valid phone number (at least 7 digits).');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/contact-form/submit`,
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
            service: formData.service,
            message: formData.message.trim(),
            clientType: activeClientType,
            website: formData.website,  // honeypot
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        console.error('Contact form submission error:', result);
        toast.error(result.error || 'Something went wrong. Please try again.');
        return;
      }

      // Show thank you modal
      setThankYouModalOpen(true);
      
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        investmentAmount: '',
        service: '',
        message: '',
        website: '',
      });
    } catch (error) {
      console.error('Contact form network error:', error);
      toast.error('Unable to submit your enquiry. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const clientTypes = {
    individuals: {
      label: 'Individuals',
      icon: Users,
      phone: '+27 (0)12 667 2505',
      email: 'info@navigatewealth.co',
      description: 'Personal wealth management and financial planning for individuals and families.',
      services: [
        'Personal Investment Management',
        'Retirement Planning',
        'Risk Management',
        'Estate Planning',
        'Tax Planning'
      ]
    },
    business: {
      label: 'Business',
      icon: Building,
      phone: '+27 (0)12 667 2505',
      email: 'info@navigatewealth.co',
      description: 'Comprehensive financial solutions for businesses of all sizes.',
      services: [
        'Corporate Investment Solutions',
        'Employee Benefits',
        'Business Risk Management',
        'Corporate Tax Planning',
        'Executive Benefits'
      ]
    },
    advisors: {
      label: 'Advisors',
      icon: UserCheck,
      phone: '+27 (0)12 667 2505',
      email: 'info@navigatewealth.co',
      description: 'Partnership opportunities and support for financial advisors.',
      services: [
        'Advisor Support Services',
        'Practice Management',
        'Technology Solutions',
        'Training & Development',
        'Compliance Support'
      ]
    }
  };

  return (
    <div className="contents">
      {/* SEO Meta Tags */}
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        canonicalUrl={seoData.canonicalUrl}
        ogType={seoData.ogType}
        structuredData={contactPageStructuredData}
      />
      
      <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-[#111827]" aria-label="Hero">
        <div className="absolute inset-0 bg-gradient-to-b from-[#111827] via-[#161b33] to-[#111827] pointer-events-none" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full opacity-20 pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(109,40,217,0.25) 0%, transparent 70%)' }} />

        <div className="relative z-10 max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center text-center py-20 lg:py-28">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/[0.06] border border-white/[0.08] mb-8">
              <span className="text-[12px] font-medium text-gray-400 tracking-wide">Get In Touch</span>
            </div>

            <div className="max-w-3xl space-y-5">
              <h1 className="!text-[clamp(2rem,5vw,3.5rem)] !font-extrabold !leading-[1.1] text-white tracking-tight">
                Contact{' '}
                <span className="bg-gradient-to-r from-purple-400 to-violet-300 bg-clip-text text-transparent">Us</span>
              </h1>
              <p className="text-gray-400 text-base sm:text-lg max-w-2xl mx-auto leading-relaxed">
                Ready to take control of your financial future? Schedule a complimentary consultation with our wealth management experts.
              </p>
            </div>

            {/* Quick Contact Options */}
            <div className="grid md:grid-cols-2 gap-3 mt-10 max-w-xl w-full">
              <div className="flex items-center gap-3 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/[0.15] flex items-center justify-center flex-shrink-0">
                  <Phone className="h-4 w-4 text-purple-400" />
                </div>
                <div className="text-left">
                  <p className="text-[11px] text-gray-500">Switchboard</p>
                  <p className="text-sm text-white font-medium">012 667 2025</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-white/[0.06] border border-white/[0.08] rounded-xl px-4 py-3">
                <div className="w-9 h-9 rounded-lg bg-purple-500/[0.15] flex items-center justify-center flex-shrink-0">
                  <Mail className="h-4 w-4 text-purple-400" />
                </div>
                <div className="text-left">
                  <p className="text-[11px] text-gray-500">Email us</p>
                  <p className="text-sm text-white font-medium">info@navigatewealth.co</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Client Type Selector Section - White */}
      <section className="py-16 relative overflow-hidden bg-white">
        <div className="relative max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="text-center mb-12">
            <Badge className="bg-primary/10 text-primary border-primary/20 mb-6">
              Choose Your Team
            </Badge>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Get In Touch
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Select the option that best describes you to connect with the right team member.
            </p>
          </div>

          {/* Client Type Tabs - Mobile Dropdown */}
          <div className="md:hidden mb-8 max-w-sm mx-auto">
            <Select value={activeClientType} onValueChange={setActiveClientType}>
              <SelectTrigger className="w-full bg-white border-2 border-gray-200 hover:border-primary transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(clientTypes).map(([key, type]) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={key} value={key}>
                      <div className="flex items-center space-x-2">
                        <Icon className="h-4 w-4" />
                        <span>{type.label}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Client Type Tabs - Desktop */}
          <div className="hidden md:flex justify-center mb-8">
            <div className="inline-flex bg-white rounded-2xl p-2 shadow-lg border border-gray-200">
              {Object.entries(clientTypes).map(([key, type]) => {
                const Icon = type.icon;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveClientType(key)}
                    className={`flex items-center space-x-2 px-6 py-3 rounded-xl transition-all duration-300 ${
                      activeClientType === key
                        ? 'bg-primary text-white shadow-md'
                        : 'text-gray-600 hover:text-primary hover:bg-primary/5'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="font-medium">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Client Type Content */}
          <div className="max-w-4xl mx-auto">
            {Object.entries(clientTypes).map(([key, type]) => {
              const Icon = type.icon;
              return (
                <div
                  key={key}
                  className={`transition-all duration-300 ${
                    activeClientType === key ? 'opacity-100 block' : 'opacity-0 hidden'
                  }`}
                >
                  <div className="bg-white rounded-3xl shadow-xl border border-gray-200 overflow-hidden">
                    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 p-8 border-b border-gray-100">
                      <div className="text-center mb-4">
                        <h3 className="text-2xl font-bold text-gray-900">{type.label}</h3>
                        <p className="text-gray-600 mt-1">{type.description}</p>
                      </div>

                      {/* Quick Contact Options */}
                      <div className="grid md:grid-cols-2 gap-4 mt-6">
                        <div className="flex items-center space-x-3 bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-primary/10">
                          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                            <Phone className="h-5 w-5 text-white" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm text-gray-600">Direct Line</p>
                            <p className="text-gray-900 font-medium">{type.phone}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3 bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-primary/10">
                          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                            <Mail className="h-5 w-5 text-white" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm text-gray-600">Email Direct</p>
                            <p className="text-gray-900 font-medium">{type.email}</p>
                          </div>
                        </div>
                      </div>

                      {/* Services List */}
                      <div className="mt-6">
                        <h4 className="text-lg font-semibold text-gray-900 mb-3">Our {type.label} Services:</h4>
                        <div className="grid md:grid-cols-2 gap-2">
                          {type.services.map((service, index) => (
                            <div key={index} className="flex items-center space-x-2">
                              <CheckCircle className="h-4 w-4 text-primary flex-shrink-0" />
                              <span className="text-gray-700 text-sm">{service}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Specialized Contact Form */}
                    <div className="p-8">
                      <h4 className="text-xl font-bold text-gray-900 mb-6 text-center">
                        Send us a Message
                      </h4>
                      
                      <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Honeypot — invisible to users, bots will fill it */}
                        <div className="absolute opacity-0 pointer-events-none h-0 overflow-hidden" aria-hidden="true" tabIndex={-1}>
                          <label htmlFor={`${key}-website`}>Website</label>
                          <input
                            id={`${key}-website`}
                            name="website"
                            type="text"
                            value={formData.website}
                            onChange={(e) => handleInputChange('website', e.target.value)}
                            autoComplete="off"
                            tabIndex={-1}
                          />
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`${key}-firstName`} className="flex items-center text-gray-700">
                              <Users className="h-4 w-4 mr-2 text-primary" />
                              First Name
                            </Label>
                            <Input
                              id={`${key}-firstName`}
                              value={formData.firstName}
                              onChange={(e) => handleInputChange('firstName', e.target.value)}
                              className="bg-gray-50/50 border-gray-200 focus:border-primary focus:bg-white transition-all duration-200 rounded-lg h-12"
                              placeholder="Enter your first name"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`${key}-lastName`} className="flex items-center text-gray-700">
                              <Users className="h-4 w-4 mr-2 text-primary" />
                              Last Name
                            </Label>
                            <Input
                              id={`${key}-lastName`}
                              value={formData.lastName}
                              onChange={(e) => handleInputChange('lastName', e.target.value)}
                              className="bg-gray-50/50 border-gray-200 focus:border-primary focus:bg-white transition-all duration-200 rounded-lg h-12"
                              placeholder="Enter your last name"
                              required
                            />
                          </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor={`${key}-email`} className="flex items-center text-gray-700">
                              <Mail className="h-4 w-4 mr-2 text-primary" />
                              Email Address
                            </Label>
                            <Input
                              id={`${key}-email`}
                              type="email"
                              value={formData.email}
                              onChange={(e) => handleInputChange('email', e.target.value)}
                              className="bg-gray-50/50 border-gray-200 focus:border-primary focus:bg-white transition-all duration-200 rounded-lg h-12"
                              placeholder="Enter your email"
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`${key}-phone`} className="flex items-center text-gray-700">
                              <Phone className="h-4 w-4 mr-2 text-primary" />
                              Phone Number
                            </Label>
                            <Input
                              id={`${key}-phone`}
                              type="tel"
                              value={formData.phone}
                              onChange={(e) => handleInputChange('phone', e.target.value)}
                              className="bg-gray-50/50 border-gray-200 focus:border-primary focus:bg-white transition-all duration-200 rounded-lg h-12"
                              placeholder="Enter your phone number"
                              required
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor={`${key}-message`} className="flex items-center text-gray-700">
                            <MessageCircle className="h-4 w-4 mr-2 text-primary" />
                            Message
                          </Label>
                          <Textarea
                            id={`${key}-message`}
                            value={formData.message}
                            onChange={(e) => handleInputChange('message', e.target.value)}
                            className="bg-gray-50/50 border-gray-200 focus:border-primary focus:bg-white transition-all duration-200 rounded-lg resize-none"
                            rows={4}
                            placeholder={`Tell us about your ${key === 'individuals' ? 'financial goals' : key === 'business' ? 'business needs' : 'advisory requirements'} or any specific questions you have...`}
                          />
                        </div>

                        <div className="flex justify-center pt-4">
                          <Button 
                            type="submit"
                            size="lg"
                            disabled={isSubmitting}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transform transition-all duration-200 px-12 py-4 shadow-lg hover:shadow-xl rounded-lg group disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100"
                          >
                            {isSubmitting ? (
                              <div className="contents">
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Submitting...
                              </div>
                            ) : (
                              <div className="contents">
                                <Calendar className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform duration-200" />
                                Contact {type.label} Team
                                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
                              </div>
                            )}
                          </Button>
                        </div>

                        {/* Trust indicators */}
                        <div className="flex items-center justify-center space-x-6 pt-4 border-t border-gray-100">
                          <div className="flex items-center text-sm text-gray-500">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            Free consultation
                          </div>
                          <div className="flex items-center text-sm text-gray-500">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            No obligation
                          </div>
                          <div className="flex items-center text-sm text-gray-500">
                            <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                            24hr response
                          </div>
                        </div>
                      </form>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>



      {/* Thank You Modal */}
      <ThankYouModal 
        open={thankYouModalOpen} 
        onOpenChange={setThankYouModalOpen} 
        clientName={`${formData.firstName} ${formData.lastName}`.trim()}
      />
      </div>
    </div>
    );
}