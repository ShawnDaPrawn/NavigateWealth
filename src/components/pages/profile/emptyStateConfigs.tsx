/**
 * Empty State Configurations
 * Unique initial states for each profile tab
 */

import {
  Shield,
  MapPin,
  Briefcase,
  Heart,
  Users,
  CreditCard,
  TrendingUp,
  Target,
  DollarSign,
  Building,
  Activity,
  FileText,
  Home,
  Wallet,
  PieChart,
} from 'lucide-react';

export const emptyStateConfigs = {
  identity: {
    icon: Shield,
    title: 'Verify Your Identity',
    description: 'Securely upload your identity documents to complete your profile verification. We accept National ID, Passport, or Driver\'s License. Your documents are encrypted and stored safely.',
    actionLabel: 'Upload Identity Document',
    iconColor: 'text-[#6d28d9]',
    iconBgColor: 'bg-[#6d28d9]/10',
    buttonColor: 'bg-[#6d28d9]',
    buttonHoverColor: 'hover:bg-[#5b21b6]',
  },

  address: {
    icon: MapPin,
    title: 'Set Up Your Address Information',
    description: 'Add your residential address details and proof of residence. This helps us verify your location and ensures we can reach you when needed. You can also include your work address for comprehensive records.',
    actionLabel: 'Add Residential Address',
    iconColor: 'text-blue-600',
    iconBgColor: 'bg-blue-50',
    buttonColor: 'bg-blue-600',
    buttonHoverColor: 'hover:bg-blue-700',
  },

  employment: {
    icon: Briefcase,
    title: 'Tell Us About Your Employment',
    description: 'Share your current employment status and work details. Whether you\'re employed, self-employed, or retired, this information helps us understand your financial situation and provide tailored advice.',
    actionLabel: 'Add Employment Information',
    iconColor: 'text-amber-600',
    iconBgColor: 'bg-amber-50',
    buttonColor: 'bg-amber-600',
    buttonHoverColor: 'hover:bg-amber-700',
  },

  health: {
    icon: Activity,
    title: 'Complete Your Health Profile',
    description: 'Document your health information including vital statistics and lifestyle habits. This data enables us to provide comprehensive health-related financial planning, including insurance recommendations.',
    actionLabel: 'Add Health Information',
    iconColor: 'text-red-500',
    iconBgColor: 'bg-red-50',
    buttonColor: 'bg-red-500',
    buttonHoverColor: 'hover:bg-red-600',
  },

  chronicConditions: {
    icon: Heart,
    title: 'Record Health Conditions',
    description: 'Maintain a detailed record of any health conditions you manage. This information is confidential and helps us provide accurate health insurance guidance and estate planning considerations.',
    actionLabel: 'Add Health Condition',
    iconColor: 'text-pink-600',
    iconBgColor: 'bg-pink-50',
    buttonColor: 'bg-pink-600',
    buttonHoverColor: 'hover:bg-pink-700',
  },

  family: {
    icon: Users,
    title: 'Build Your Family Tree',
    description: 'Add your family members and dependents to create a complete picture of your household. This information is crucial for estate planning, beneficiary designations, and comprehensive wealth management.',
    actionLabel: 'Add Family Member',
    iconColor: 'text-green-600',
    iconBgColor: 'bg-green-50',
    buttonColor: 'bg-green-600',
    buttonHoverColor: 'hover:bg-green-700',
  },

  banking: {
    icon: CreditCard,
    title: 'Connect Your Banking Details',
    description: 'Securely link your bank accounts to enable seamless transactions and comprehensive financial tracking. We support all major South African banks. Your banking information is protected with bank-level encryption.',
    actionLabel: 'Add Bank Account',
    iconColor: 'text-indigo-600',
    iconBgColor: 'bg-indigo-50',
    buttonColor: 'bg-indigo-600',
    buttonHoverColor: 'hover:bg-indigo-700',
  },

  assets: {
    icon: TrendingUp,
    title: 'Track Your Financial Assets',
    description: 'Build a comprehensive inventory of your assets including property, investments, vehicles, and savings. Understanding your total asset value is the foundation of effective wealth management and future planning.',
    actionLabel: 'Add Your First Asset',
    iconColor: 'text-emerald-600',
    iconBgColor: 'bg-emerald-50',
    buttonColor: 'bg-emerald-600',
    buttonHoverColor: 'hover:bg-emerald-700',
  },

  liabilities: {
    icon: Wallet,
    title: 'Document Your Liabilities',
    description: 'Record your debts and financial obligations including loans, mortgages, and credit commitments. A clear view of your liabilities allows us to create strategic debt reduction plans and improve your financial health.',
    actionLabel: 'Add Your First Liability',
    iconColor: 'text-orange-600',
    iconBgColor: 'bg-orange-50',
    buttonColor: 'bg-orange-600',
    buttonHoverColor: 'hover:bg-orange-700',
  },

  riskProfile: {
    icon: Target,
    title: 'Assess Your Investment Risk Profile',
    description: 'Complete our comprehensive questionnaire to determine your investment risk tolerance. Your responses help us recommend investment strategies that align with your comfort level and financial goals.',
    actionLabel: 'Begin Risk Assessment',
    iconColor: 'text-purple-600',
    iconBgColor: 'bg-purple-50',
    buttonColor: 'bg-purple-600',
    buttonHoverColor: 'hover:bg-purple-700',
  },

  employers: {
    icon: Building,
    title: 'Add Your Employment History',
    description: 'Document your current and past employers or business ventures. Multiple income sources? No problem—add as many employers as you need. This creates a complete picture of your professional and income history.',
    actionLabel: 'Add Employer',
    iconColor: 'text-cyan-600',
    iconBgColor: 'bg-cyan-50',
    buttonColor: 'bg-cyan-600',
    buttonHoverColor: 'hover:bg-cyan-700',
  },

  businesses: {
    icon: Building,
    title: 'Register Your Business Ventures',
    description: 'Self-employed or running your own business? Share details about your entrepreneurial activities. This information helps us provide specialized tax planning and business financial advice tailored to business owners.',
    actionLabel: 'Add Business Details',
    iconColor: 'text-teal-600',
    iconBgColor: 'bg-teal-50',
    buttonColor: 'bg-teal-600',
    buttonHoverColor: 'hover:bg-teal-700',
  },

  budgeting: {
    icon: PieChart,
    title: 'Start Your Budget Journey',
    description: 'To create your personalized budget using the 50-30-20 rule, we need your Net Monthly Income (Post-Tax). Head to the Personal Information tab to enter your take-home pay, then return here to automatically generate your budget breakdown.',
    actionLabel: 'Go to Personal Info',
    iconColor: 'text-violet-600',
    iconBgColor: 'bg-violet-50',
    buttonColor: 'bg-violet-600',
    buttonHoverColor: 'hover:bg-violet-700',
  },
};

export type EmptyStateConfigKey = keyof typeof emptyStateConfigs;