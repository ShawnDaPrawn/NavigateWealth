import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { SEO, createWebPageSchema } from '../seo/SEO';
import { getSEOData } from '../seo/seo-config';
import { 
  Shield, 
  Target, 
  TrendingUp, 
  Building2, 
  Calculator, 
  ClipboardList, 
  Users, 
  ArrowRight,
  Package,
  Search,
  CheckCircle2,
  Zap,
  LayoutGrid,
  List as ListIcon
} from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { useAuth } from '../auth/AuthContext';
import { Card } from '../ui/card';

interface ServiceFeature {
  label: string;
}

interface Service {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  path: string;
  category: string;
  color: string;
  features: ServiceFeature[];
  popular?: boolean;
}

export function ProductsServicesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const services: Service[] = [
    {
      id: 'risk',
      title: 'Risk Management',
      description: 'Comprehensive insurance solutions to safeguard your family, assets, and income against unexpected events.',
      icon: Shield,
      path: '/risk-management',
      category: 'Protection',
      color: 'text-blue-600 bg-blue-50 border-blue-100',
      popular: true,
      features: [
        { label: 'Life Insurance' },
        { label: 'Disability Cover' },
        { label: 'Dread Disease' }
      ]
    },
    {
      id: 'medical',
      title: 'Medical Aid',
      description: 'Expert guidance on medical aid schemes to ensure you and your family have access to quality healthcare.',
      icon: Users, // Changed from Heart to Users based on screenshot generic look, but Heart fits better. keeping Users for now or Shield? Let's use Heart/Activity logic. Actually screenshot used a heart icon.
      path: '/medical-aid', // Assuming path
      category: 'Health',
      color: 'text-rose-600 bg-rose-50 border-rose-100',
      features: [
        { label: 'Scheme Comparison' },
        { label: 'Benefits Analysis' },
        { label: 'Gap Cover' }
      ]
    },
    {
      id: 'retirement',
      title: 'Retirement Planning',
      description: 'Strategic retirement planning to help you build and preserve wealth for a comfortable future.',
      icon: Target, // Screenshot uses Piggy bank? Target is good for goals.
      path: '/retirement-planning',
      category: 'Future',
      color: 'text-orange-600 bg-orange-50 border-orange-100',
      features: [
        { label: 'Retirement Annuities' },
        { label: 'Pension Funds' },
        { label: 'Living Annuities' }
      ]
    },
    {
      id: 'investment',
      title: 'Investment Management',
      description: 'Tailored investment strategies designed to help you achieve your financial goals with confidence.',
      icon: TrendingUp,
      path: '/investment-management',
      category: 'Growth',
      color: 'text-green-600 bg-green-50 border-green-100',
      popular: true,
      features: [
        { label: 'Local Portfolios' },
        { label: 'Offshore Investments' },
        { label: 'Tax-Free Savings' }
      ]
    },
    {
      id: 'employee',
      title: 'Employee Benefits',
      description: 'Optimize your employee benefits package with expert advice on group schemes and wellness.',
      icon: Building2,
      path: '/employee-benefits',
      category: 'Business',
      color: 'text-purple-600 bg-purple-50 border-purple-100',
      features: [
        { label: 'Group Risk' },
        { label: 'Retirement Funds' },
        { label: 'Employee Wellness' }
      ]
    },
    {
      id: 'tax',
      title: 'Tax Planning',
      description: 'Strategic tax planning solutions to help you optimize your tax position and ensure compliance.',
      icon: Calculator,
      path: '/tax-planning',
      category: 'Finance',
      color: 'text-slate-600 bg-slate-50 border-slate-100',
      features: [
        { label: 'Personal Tax' },
        { label: 'Business Tax' },
        { label: 'Tax Clearance' }
      ]
    },
    {
      id: 'estate',
      title: 'Estate Planning',
      description: 'Legacy planning and wealth transfer strategies to protect your family\'s future generations.',
      icon: ClipboardList,
      path: '/estate-planning',
      category: 'Legacy',
      color: 'text-indigo-600 bg-indigo-50 border-indigo-100',
      features: [
        { label: 'Wills & Trusts' },
        { label: 'Executor Services' },
        { label: 'Estate Duty' }
      ]
    },
    {
      id: 'financial',
      title: 'Financial Planning',
      description: 'Holistic financial planning to align your money with your life goals and aspirations.',
      icon: Zap,
      path: '/financial-planning',
      category: 'Strategy',
      color: 'text-amber-600 bg-amber-50 border-amber-100',
      features: [
        { label: 'Wealth Analysis' },
        { label: 'Goal Setting' },
        { label: 'Budgeting' }
      ]
    }
  ];

  const filteredServices = services.filter(service => 
    service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    service.features.some(f => f.label.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="min-h-screen bg-gray-50/50">
      <SEO {...getSEOData('products-services')} structuredData={createWebPageSchema(getSEOData('products-services').title, getSEOData('products-services').description, getSEOData('products-services').canonicalUrl)} />
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-purple-100 bg-gradient-to-r from-white to-purple-50/50">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-purple-600 font-medium mb-1">
                  <Package className="h-5 w-5" />
                  <span>Financial Hub</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                  Products & Services
                </h1>
                <p className="text-gray-600 max-w-2xl leading-relaxed">
                  Welcome back, <span className="font-semibold text-gray-900">{user?.email || 'User'}</span>! 
                  Select any module below to explore your products, view recommendations, and manage your financial services. 
                  Our team is here to guide you every step of the way.
                </p>
              </div>
              
              {/* Search & View Toggle */}
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Find a service..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-full sm:w-64 bg-white border-gray-200 focus:border-purple-500 focus:ring-purple-500 transition-all"
                  />
                </div>
                <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-md transition-all ${
                      viewMode === 'grid' 
                        ? 'bg-white text-purple-600 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-md transition-all ${
                      viewMode === 'list' 
                        ? 'bg-white text-purple-600 shadow-sm' 
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <ListIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Services Grid/List */}
        <motion.div 
          variants={container}
          initial="hidden"
          animate="show"
          className={
            viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6"
              : "space-y-4"
          }
        >
          {filteredServices.map((service) => {
            const Icon = service.icon;
            
            if (viewMode === 'list') {
              return (
                <motion.div variants={item} key={service.id}>
                  <Link to={service.path} className="block group">
                    <Card className="p-6 hover:shadow-md transition-all border-gray-200 group-hover:border-purple-200">
                      <div className="flex items-center gap-6">
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${service.color}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="text-lg font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                              {service.title}
                            </h3>
                            {service.popular && (
                              <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-100 text-[10px] px-2 py-0.5 h-5">
                                Popular
                              </Badge>
                            )}
                          </div>
                          <p className="text-gray-600 text-sm truncate">
                            {service.description}
                          </p>
                        </div>
                        <div className="hidden sm:flex gap-4 mr-6">
                          {service.features.slice(0, 2).map((feature, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-xs text-gray-500">
                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                              {feature.label}
                            </div>
                          ))}
                        </div>
                        <div className="bg-gray-50 p-2 rounded-full group-hover:bg-purple-100 transition-colors">
                          <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              );
            }

            return (
              <motion.div variants={item} key={service.id}>
                <Link to={service.path} className="block h-full group">
                  <Card className="h-full flex flex-col p-6 hover:shadow-xl transition-all duration-300 border-gray-200 group-hover:border-purple-300 relative overflow-hidden bg-white">
                    {/* Hover Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-purple-50/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    {/* Top Section */}
                    <div className="relative mb-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className={`h-14 w-14 rounded-2xl flex items-center justify-center ${service.color} shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                          <Icon className="h-7 w-7" />
                        </div>
                        {service.popular && (
                          <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0 shadow-sm">
                            Popular
                          </Badge>
                        )}
                      </div>
                      
                      <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-purple-700 transition-colors">
                        {service.title}
                      </h3>
                      <p className="text-gray-600 text-sm leading-relaxed">
                        {service.description}
                      </p>
                    </div>

                    {/* Divider */}
                    <div className="h-px bg-gray-100 my-2" />

                    {/* Features Section */}
                    <div className="relative flex-1 py-4">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        Key Features
                      </p>
                      <ul className="space-y-2.5">
                        {service.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2.5 text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                            <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            <span>{feature.label}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Action Button */}
                    <div className="relative mt-4">
                      <div className="w-full bg-purple-600 text-white h-11 rounded-lg flex items-center justify-center font-medium gap-2 group-hover:bg-purple-700 transition-all shadow-sm group-hover:shadow-purple-200 group-hover:shadow-lg transform group-hover:-translate-y-0.5">
                        <span>Access Module</span>
                        <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </div>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
        
        {/* Empty State */}
        {filteredServices.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mb-4">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No services found</h3>
            <p className="text-gray-500">
              We couldn't find any services matching "{searchQuery}"
            </p>
            <Button 
              variant="link" 
              onClick={() => setSearchQuery('')}
              className="text-purple-600 mt-2"
            >
              Clear search
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}