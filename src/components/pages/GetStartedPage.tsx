import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { SEO } from '../seo/SEO';
import { getSEOData } from '../seo/seo-config';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { useAuth } from '../auth/AuthContext';
import { ArrowRight, User, Mail, Phone, CheckCircle, ChevronLeft, ChevronRight, Shield, Target, Users, Zap } from 'lucide-react';
import { Logo } from '../layout/Logo';

const carouselSlides = [
  {
    id: 1,
    title: "Personalized wealth strategies",
    subtitle: "We create custom financial plans tailored to your unique goals and circumstances.",
    content: (
      <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 space-y-4">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center">
            <Target className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-white font-semibold">Your Financial Goals</div>
            <div className="text-white/70 text-sm">Customized strategies for success</div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
            <span className="text-white/90 text-sm">Retirement Planning</span>
            <div className="w-16 h-2 bg-white/20 rounded-full">
              <div className="w-12 h-2 bg-white/60 rounded-full"></div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
            <span className="text-white/90 text-sm">Investment Growth</span>
            <div className="w-16 h-2 bg-white/20 rounded-full">
              <div className="w-10 h-2 bg-white/60 rounded-full"></div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 bg-white/10 rounded-lg">
            <span className="text-white/90 text-sm">Risk Management</span>
            <div className="w-16 h-2 bg-white/20 rounded-full">
              <div className="w-14 h-2 bg-white/60 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 2,
    title: "Expert financial guidance",
    subtitle: "Our certified advisors provide professional insights and support throughout your journey.",
    content: (
      <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 space-y-4">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-white font-semibold">Advisory Team</div>
            <div className="text-white/70 text-sm">Professional expertise at your service</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-white font-semibold text-lg">15+</div>
            <div className="text-white/70 text-xs">Years Experience</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-white font-semibold text-lg">500+</div>
            <div className="text-white/70 text-xs">Happy Clients</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-white font-semibold text-lg">98%</div>
            <div className="text-white/70 text-xs">Client Satisfaction</div>
          </div>
          <div className="bg-white/10 rounded-lg p-3 text-center">
            <div className="text-white font-semibold text-lg">$2B+</div>
            <div className="text-white/70 text-xs">Assets Managed</div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 3,
    title: "Secure, trusted platform",
    subtitle: "Your financial data is protected with bank-level security and industry-leading encryption.",
    content: (
      <div className="bg-white/20 backdrop-blur-sm rounded-xl p-6 space-y-4">
        <div className="flex items-center space-x-3 mb-4">
          <div className="w-10 h-10 bg-white/30 rounded-full flex items-center justify-center">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="text-white font-semibold">Security & Trust</div>
            <div className="text-white/70 text-sm">Your protection is our priority</div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center space-x-3 p-3 bg-white/10 rounded-lg">
            <CheckCircle className="h-4 w-4 text-white/80" />
            <span className="text-white/90 text-sm">256-bit SSL Encryption</span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-white/10 rounded-lg">
            <CheckCircle className="h-4 w-4 text-white/80" />
            <span className="text-white/90 text-sm">Two-Factor Authentication</span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-white/10 rounded-lg">
            <CheckCircle className="h-4 w-4 text-white/80" />
            <span className="text-white/90 text-sm">Regular Security Audits</span>
          </div>
          <div className="flex items-center space-x-3 p-3 bg-white/10 rounded-lg">
            <CheckCircle className="h-4 w-4 text-white/80" />
            <span className="text-white/90 text-sm">FDIC Insured Accounts</span>
          </div>
        </div>
      </div>
    )
  }
];

export function GetStartedPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();



  // Pre-populate form with user data if available
  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: ''
      });
    }
  }, [user]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Update user context
    updateUser({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email
    });

    setIsLoading(false);
    navigate('/application');
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % carouselSlides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length);
  };

  const isFormValid = formData.firstName && formData.lastName && formData.email && formData.phone;

  return (
    <div className="min-h-screen flex">
      <SEO {...getSEOData('get-started')} />
      {/* Left Side - Get Started Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-md w-full space-y-8">
          {/* Logo */}
          <div className="text-center">
            <Logo />
          </div>

          {/* Header */}
          <div className="text-center space-y-2">
            <div className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-medium mb-4">
              <CheckCircle className="h-4 w-4 mr-2" />
              Welcome to Navigate Wealth
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Complete Your Profile</h1>
            <p className="text-gray-500">Verify and complete your information before starting your application</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-gray-700">First Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="firstName"
                    type="text"
                    placeholder="John"
                    value={formData.firstName}
                    onChange={(e) => handleInputChange('firstName', e.target.value)}
                    className="pl-10 border-gray-300"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-gray-700">Last Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="lastName"
                    type="text"
                    placeholder="Smith"
                    value={formData.lastName}
                    onChange={(e) => handleInputChange('lastName', e.target.value)}
                    className="pl-10 border-gray-300"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-700">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="john.smith@example.com"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="pl-10 border-gray-300"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-gray-700">Contact Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1 (555) 123-4567"
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="pl-10 border-gray-300"
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              disabled={!isFormValid || isLoading}
            >
              {isLoading ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Processing...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span>Continue to Application</span>
                  <ArrowRight className="h-4 w-4" />
                </div>
              )}
            </Button>
          </form>

          {/* Security Notice */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Your information is protected with bank-level security encryption
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Carousel */}
      <div className="hidden lg:flex lg:flex-1 relative section-dark-gray">
        <div className="absolute inset-0 bg-black/20"></div>
        
        {/* Carousel Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 w-full">
          <div className="max-w-md mx-auto text-center space-y-8">
            {/* Current Slide Content */}
            <div className="space-y-6">
              <h2 className="text-3xl font-bold text-white">
                {carouselSlides[currentSlide].title}
              </h2>
              <p className="text-white/80 text-lg">
                {carouselSlides[currentSlide].subtitle}
              </p>
              {carouselSlides[currentSlide].content}
            </div>

            {/* Carousel Controls */}
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={prevSlide}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              {/* Dots */}
              <div className="flex space-x-2">
                {carouselSlides.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentSlide(index)}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      index === currentSlide ? 'bg-white' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>

              <button
                onClick={nextSlide}
                className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-white"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}