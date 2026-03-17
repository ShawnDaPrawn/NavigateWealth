/**
 * Constants for Documents/History module
 */

import { FileText, Shield, TrendingUp, Activity, Briefcase, Home, Link, File } from 'lucide-react';

export const DOCUMENT_TYPES = {
  DOCUMENT: 'document',
  LINK: 'link'
} as const;

export type DocumentType = typeof DOCUMENT_TYPES[keyof typeof DOCUMENT_TYPES];

export const DOCUMENT_STATUS = {
  NEW: 'new',
  VIEWED: 'viewed',
  ARCHIVED: 'archived'
} as const;

export type DocumentStatus = typeof DOCUMENT_STATUS[keyof typeof DOCUMENT_STATUS];

export const PRODUCT_CATEGORIES = [
  'General',
  'Life',
  'Short-Term',
  'Investment',
  'Medical Aid',
  'Retirement',
  'Estate'
] as const;

export type ProductCategory = typeof PRODUCT_CATEGORIES[number];

export const CATEGORY_CONFIG = {
  'Life': {
    color: 'bg-red-50 text-red-700 border-red-200',
    icon: 'Heart'
  },
  'Short-Term': {
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: 'Shield'
  },
  'Investment': {
    color: 'bg-green-50 text-green-700 border-green-200',
    icon: 'TrendingUp'
  },
  'Medical Aid': {
    color: 'bg-purple-50 text-purple-700 border-purple-200',
    icon: 'Activity'
  },
  'Retirement': {
    color: 'bg-orange-50 text-orange-700 border-orange-200',
    icon: 'Briefcase'
  },
  'Estate': {
    color: 'bg-amber-50 text-amber-700 border-amber-200',
    icon: 'Home'
  },
  'General': {
    color: 'bg-gray-50 text-gray-700 border-gray-200',
    icon: 'FileText'
  }
} as const;

export const DATE_RANGE_OPTIONS = [
  { label: 'All Time', value: 'all' },
  { label: 'Last 30 Days', value: '30days', days: 30 },
  { label: 'Last 3 Months', value: '90days', days: 90 },
  { label: 'Last Year', value: '1year', days: 365 }
] as const;

export const FILE_CONSTRAINTS = {
  MAX_SIZE_MB: 50,
  MAX_SIZE_BYTES: 50 * 1024 * 1024,
  ALLOWED_EXTENSIONS: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.jpg', '.jpeg', '.png'],
  ALLOWED_MIME_TYPES: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/gif'
  ]
} as const;

export const URL_REGEX = /^(https?:\/\/)?([\da-z\.-]+)\.([a-z\.]{2,6})([\/\w \.-]*)*\/?$/;
