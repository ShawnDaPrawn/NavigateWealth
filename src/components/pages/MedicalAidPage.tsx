/**
 * MedicalAidPage — Refactored to use ServicePageTemplate.
 *
 * Previously hand-built inline matching the RiskManagementPage v3 template.
 * Now uses the same ServicePageTemplate as all other service pages,
 * ensuring a single source of truth for layout, modals, and section order.
 */

import React from 'react';
import { useImagePreload } from '../../hooks/useImagePreload';
import { getSEOData } from '../seo/seo-config';
import { ServicePageTemplate, type CoverContent } from '../templates/ServicePageTemplate';
import {
  Heart,
  Users,
  Shield,
  Activity,
  Stethoscope,
  Crown,
  Briefcase,
  Search,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';
import {
  discoveryLogo,
  momentumLogo,
}
 from '../shared/assets/provider-logos';

// Product images
import image_974aab623b920eed5028b31b90f6ad78d88b7922 from 'figma:asset/974aab623b920eed5028b31b90f6ad78d88b7922.png';
import image_06f4f0d6aa6b0eb2450e2a43380c2e2d29ad658b from 'figma:asset/06f4f0d6aa6b0eb2450e2a43380c2e2d29ad658b.png';
import image_708b0e7710c401ef95a1826b60aa1fa5c231ef80 from 'figma:asset/708b0e7710c401ef95a1826b60aa1fa5c231ef80.png';
import image_0e2b917f64eba502a24068ea5244bd25b0dfc9d5 from 'figma:asset/0e2b917f64eba502a24068ea5244bd25b0dfc9d5.png';
import image_cfc1e439140eb46cc77ba92fad420182d167227d from 'figma:asset/cfc1e439140eb46cc77ba92fad420182d167227d.png';
import wellnessProgramImage from 'figma:asset/0a60effb7ee71f5609f910b26a2203fd47255d98.png';
import medicalHeroImage from 'figma:asset/d0fa22ed135e395dabc605d8378a0fbcd5642ed7.png';

// ── Partner logos for marquee ─────────────────────────────────────────────────

const partnerLogos = [
  { id: 'discovery', name: 'Discovery Health', logo: discoveryLogo, est: '1992' },
  { id: 'momentum', name: 'Momentum Health', logo: momentumLogo, est: '1966' },
];

// ── Tab icons ─────────────────────────────────────────────────────────────────

const INDIVIDUAL_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'comprehensive': Stethoscope,
  'hospital': Shield,
  'savings': Heart,
};

const BUSINESS_TAB_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'group-schemes': Users,
  'wellness': Activity,
  'executive': Crown,
};

// ── Individual product data ───────────────────────────────────────────────────

const individualToggleOptions = [
  { id: 'comprehensive', label: 'Comprehensive' },
  { id: 'hospital', label: 'Hospital Plans' },
  { id: 'savings', label: 'Medical Savings' },
];

const individualProducts: Record<string, CoverContent> = {
  'comprehensive': {
    title: 'Comprehensive Medical Aid',
    description: 'Full coverage with unlimited private hospital benefits and comprehensive day-to-day benefits.',
    benefitsDescription: 'Comprehensive medical aid provides the highest level of healthcare coverage, ensuring you have access to private hospitals, specialists, and day-to-day medical expenses. This premium option offers peace of mind with unlimited hospital benefits and generous annual limits for routine healthcare needs, prescription medicines, and preventative care.',
    features: [
      { title: 'Hospital Cover', description: 'Unlimited private hospital and specialist cover' },
      { title: 'Day-to-Day Benefits', description: 'GP visits, chronic medication, preventative care' },
      { title: 'Specialist Access', description: 'Direct access to specialist networks' },
      { title: 'Emergency Cover', description: 'Emergency medical cover worldwide' },
    ],
    benefits: [
      'Unlimited private hospital cover',
      'High day-to-day benefit limits',
      'Access to specialist networks',
      'Preventative care benefits',
      'Emergency medical cover worldwide',
    ],
    image: image_708b0e7710c401ef95a1826b60aa1fa5c231ef80,
  },
  'hospital': {
    title: 'Hospital Plans',
    description: 'Focus on major medical expenses with comprehensive hospital cover and emergency benefits.',
    benefitsDescription: 'Hospital plans are designed for individuals who want protection against major medical expenses while managing day-to-day healthcare costs independently. These plans provide comprehensive cover for hospitalization, emergency treatment, and major medical procedures, offering excellent value for those who don\'t require extensive day-to-day benefits.',
    features: [
      { title: 'In-Hospital Cover', description: 'Private hospital accommodation and procedures' },
      { title: 'Emergency Treatment', description: 'Emergency room and ambulance services' },
      { title: 'Chronic Medication', description: 'Prescribed minimum benefits for chronic conditions' },
      { title: 'Major Diagnostics', description: 'Cover for significant diagnostic procedures' },
    ],
    benefits: [
      'Private hospital accommodation',
      'Specialist consultations in hospital',
      'Emergency room treatment',
      'Chronic medication benefits',
      'Major diagnostic procedures',
    ],
    image: image_0e2b917f64eba502a24068ea5244bd25b0dfc9d5,
  },
  'savings': {
    title: 'Medical Savings Plans',
    description: 'Combination of hospital cover with a savings component for day-to-day medical expenses.',
    benefitsDescription: 'Medical savings plans combine hospital benefits with a personal medical savings account that you can use for day-to-day healthcare expenses. This flexible approach allows you to manage routine medical costs while maintaining comprehensive cover for major medical events, with unused savings rolling over to the following year.',
    features: [
      { title: 'Savings Account', description: 'Personal medical savings for day-to-day costs' },
      { title: 'Hospital Cover', description: 'Comprehensive hospital and emergency benefits' },
      { title: 'Rollover Savings', description: 'Unused savings carry over to next year' },
      { title: 'Tax Benefits', description: 'Tax-deductible contributions' },
    ],
    benefits: [
      'Personal medical savings account',
      'Hospital and emergency cover',
      'Rollover of unused savings',
      'Above threshold benefits',
      'Tax-deductible contributions',
    ],
    image: image_cfc1e439140eb46cc77ba92fad420182d167227d,
  },
};

const individualImageAltMap: Record<string, string> = {
  'comprehensive': 'Comprehensive medical aid coverage with doctor consultation',
  'hospital': 'Hospital plan providing emergency and major medical cover',
  'savings': 'Medical savings plan with personal savings component',
};

// ── Business product data ─────────────────────────────────────────────────────

const businessToggleOptions = [
  { id: 'group-schemes', label: 'Group Schemes' },
  { id: 'wellness', label: 'Wellness Programs' },
  { id: 'executive', label: 'Executive Plans' },
];

const businessProducts: Record<string, CoverContent> = {
  'group-schemes': {
    title: 'Group Medical Schemes',
    description: 'Cost-effective medical aid solutions for employee groups with comprehensive benefits.',
    benefitsDescription: 'Group medical schemes provide cost-effective healthcare benefits for your employees while offering significant savings through group discounts. These schemes improve employee satisfaction and retention while providing comprehensive medical coverage that supports workforce health and productivity.',
    features: [
      { title: 'Group Discounts', description: 'Reduced premiums through employer-negotiated group rates' },
      { title: 'Admin Support', description: 'Simplified payroll deductions and onboarding' },
      { title: 'Flexible Tiers', description: 'Multiple plan options to suit every employee' },
      { title: 'Wellness Integration', description: 'Built-in wellness programmes and screenings' },
    ],
    benefits: [
      'Group discount rates available',
      'Comprehensive employee benefits',
      'Simplified administration',
      'Flexible contribution structures',
      'Enhanced wellness programs',
    ],
    image: image_974aab623b920eed5028b31b90f6ad78d88b7922,
  },
  'wellness': {
    title: 'Corporate Wellness Programs',
    description: 'Preventative healthcare initiatives to improve employee health and productivity.',
    benefitsDescription: 'Corporate wellness programs focus on preventative healthcare and lifestyle management to reduce healthcare costs and improve employee productivity. These comprehensive programs include health screenings, wellness coaching, and lifestyle interventions that create a healthier, more engaged workforce.',
    features: [
      { title: 'Health Screenings', description: 'Regular biometric and risk assessments' },
      { title: 'Lifestyle Coaching', description: 'Personalised nutrition and fitness guidance' },
      { title: 'Mental Wellbeing', description: 'EAP and stress management resources' },
      { title: 'ROI Tracking', description: 'Measurable impact on absenteeism and costs' },
    ],
    benefits: [
      'Comprehensive health screenings',
      'Lifestyle coaching programs',
      'Preventative care initiatives',
      'Reduced absenteeism rates',
      'Improved employee morale',
    ],
    image: wellnessProgramImage,
  },
  'executive': {
    title: 'Executive Health Plans',
    description: 'Premium healthcare coverage designed for key personnel and executives.',
    benefitsDescription: 'Executive health plans provide premium medical coverage for key personnel, ensuring your leadership team has access to the best healthcare services. These comprehensive plans include enhanced benefits, priority appointments, and exclusive healthcare services that support executive health and business continuity.',
    features: [
      { title: 'Priority Access', description: 'Fast-tracked specialist appointments' },
      { title: 'Global Cover', description: 'International medical and travel benefits' },
      { title: 'Executive Assessments', description: 'Comprehensive annual health evaluations' },
      { title: 'Concierge Service', description: 'Dedicated healthcare coordination team' },
    ],
    benefits: [
      'Premium medical aid benefits',
      'Priority healthcare access',
      'Executive health assessments',
      'International travel cover',
      'Concierge healthcare services',
    ],
    image: image_06f4f0d6aa6b0eb2450e2a43380c2e2d29ad658b,
  },
};

const businessImageAltMap: Record<string, string> = {
  'group-schemes': 'Group medical scheme for employee teams and corporate healthcare',
  'wellness': 'Corporate wellness program supporting employee health',
  'executive': 'Executive health plan with premium healthcare services',
};

// ── Main page ─────────────────────────────────────────────────────────────────

export function MedicalAidPage() {
  const seoData = getSEOData('medical-aid');

  useImagePreload([
    medicalHeroImage,
    image_708b0e7710c401ef95a1826b60aa1fa5c231ef80,
    image_0e2b917f64eba502a24068ea5244bd25b0dfc9d5,
    image_cfc1e439140eb46cc77ba92fad420182d167227d,
    image_974aab623b920eed5028b31b90f6ad78d88b7922,
    wellnessProgramImage,
    image_06f4f0d6aa6b0eb2450e2a43380c2e2d29ad658b,
  ]);

  return (
    <ServicePageTemplate
      seoData={seoData}
      config={{
        seoKey: 'medical-aid',

        hero: {
          badgeText: 'Medical Aid Solutions',
          titleLine1: 'Your Health,',
          titleLine2: 'Our Priority',
          description: 'Comprehensive medical aid solutions to ensure you and your family receive the best healthcare — tailored to your needs and budget.',
          heroImage: medicalHeroImage,
          heroImageKey: 'medical-hero',
          heroImageAlt: 'Healthcare professionals providing medical consultation representing comprehensive medical aid',
          statusLabel: 'Healthcare Status',
          statusValue: 'Individuals & Businesses',
          stats: [
            { value: '2+', label: 'Leading Schemes' },
            { value: '3', label: 'Individual Plans' },
            { value: '3', label: 'Business Solutions' },
          ],
          quoteLink: '/get-quote/medical-aid',
          heroStyle: 'unified',
        },

        individuals: {
          badgeText: 'For Individuals',
          title: 'Medical Aid for Individuals & Families',
          subtitle: 'Comprehensive healthcare coverage options for every stage of life.',
          tabIcons: INDIVIDUAL_TAB_ICONS,
          toggleOptions: individualToggleOptions,
          products: individualProducts,
          imageAltMap: individualImageAltMap,
          cardIcon: Heart,
          cardLabel: 'Personal Health',
          quoteLink: '/get-quote/medical-aid',
          ariaLabel: 'Medical aid for individuals',
        },

        business: {
          badgeText: 'For Businesses',
          title: 'Medical Aid for Businesses',
          subtitle: 'Keep your team healthy and productive with group medical aid solutions.',
          tabIcons: BUSINESS_TAB_ICONS,
          toggleOptions: businessToggleOptions,
          products: businessProducts,
          imageAltMap: businessImageAltMap,
          cardIcon: Briefcase,
          cardLabel: 'Business Health',
          quoteLink: '/get-quote/medical-aid',
          ariaLabel: 'Medical aid for businesses',
        },

        partners: {
          logos: partnerLogos,
          heading: 'We work with South Africa\'s leading medical schemes',
          subHeading: 'Trusted Healthcare Partners',
        },

        form: {
          specialistType: 'medical aid',
          selectLabel: 'Medical Aid Need',
          selectPlaceholder: 'Select your need',
          selectOptions: [
            { value: 'comprehensive', label: 'Comprehensive Medical Aid' },
            { value: 'hospital-plan', label: 'Hospital Plan' },
            { value: 'savings-plan', label: 'Medical Savings Plan' },
            { value: 'gap-cover', label: 'Gap Cover Insurance' },
            { value: 'group-scheme', label: 'Group Medical Scheme' },
            { value: 'senior-plan', label: 'Senior Medical Plan' },
            { value: 'consultation', label: 'General Consultation' },
          ],
          textareaPlaceholder: 'Tell us about your medical aid requirements and family situation...',
          selectFieldName: 'medicalNeed',
        },

        structuredDataOffers: [
          { name: 'Comprehensive Medical Aid', description: 'Full coverage with unlimited private hospital benefits and day-to-day benefits.' },
          { name: 'Hospital Plans', description: 'Major medical expense cover with comprehensive hospital and emergency benefits.' },
          { name: 'Medical Savings Plans', description: 'Hospital cover with personal savings component for day-to-day expenses.' },
          { name: 'Group Medical Schemes', description: 'Cost-effective medical aid for employee groups with group discount rates.' },
          { name: 'Corporate Wellness Programs', description: 'Preventative healthcare initiatives to improve employee health.' },
          { name: 'Executive Health Plans', description: 'Premium healthcare coverage for key personnel and executives.' },
        ],
        structuredDataServiceType: 'Health Insurance Advisory',
        structuredDataServiceName: 'Medical Aid & Health Insurance',
        breadcrumbs: [
          { name: 'Home', url: 'https://navigatewealth.co' },
          { name: 'Services', url: 'https://navigatewealth.co/services' },
          { name: 'Medical Aid' },
        ],
        preloadImages: [],

        approach: {
          serviceName: 'How We Find Your Ideal Plan',
          headerDescription: 'A proven 3-step process to match you with the right medical aid solution.',
          steps: [
            {
              step: '1',
              title: 'Assess Your Needs',
              icon: Search,
              description: 'Thorough assessment of your healthcare requirements, family situation, and budget to identify the optimal solution.',
              details: [
                'Healthcare needs analysis',
                'Family structure review',
                'Budget assessment',
                'Current cover evaluation',
                'Chronic condition mapping',
              ],
              color: 'from-blue-500 to-indigo-600',
            },
            {
              step: '2',
              title: 'Compare & Recommend',
              icon: MessageSquare,
              description: 'Multi-scheme comparison across providers to find the best balance of benefits, network access, and affordability.',
              details: [
                'Multi-scheme comparison',
                'Benefit-cost analysis',
                'Network coverage review',
                'Gap cover assessment',
                'Premium optimisation',
              ],
              color: 'from-green-500 to-emerald-600',
            },
            {
              step: '3',
              title: 'Enrol & Support',
              icon: CheckCircle2,
              description: 'Full enrolment management and ongoing support to ensure you get the most from your medical aid.',
              details: [
                'Seamless enrolment',
                'Claims support',
                'Annual plan review',
                'Benefit optimisation',
                'Ongoing advisory',
              ],
              color: 'from-purple-500 to-violet-600',
            },
          ],
          summaryCards: [],
          commitmentText: 'We only proceed when you fully understand your chosen medical aid plan and are completely satisfied with your decision. Your health is our priority.',
        },
      }}
    />
  );
}