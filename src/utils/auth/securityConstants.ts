export const SECURITY_API_ENDPOINTS = {
  STATUS: (userId: string) => `/security/${userId}/status`,
  ACTIVITY: (userId: string) => `/security/${userId}/activity`,
  PASSWORD: (userId: string) => `/security/${userId}/password`,
  TWO_FACTOR: (userId: string) => `/security/${userId}/2fa`,
  VERIFY_CODE: (userId: string) => `/security/${userId}/2fa/verify-code`,
  SEND_CODE: (userId: string) => `/security/${userId}/2fa/send-code`,
};

export const PASSWORD_REQUIREMENTS = {
  MIN_LENGTH: 8,
  MIN_STRENGTH: 3, // 0-4 scale or custom logic
};

export const CONTACT_INFO = {
  SUPPORT_EMAIL: 'support@navigatewealth.co',
  PHONE: '(+27) 12-667-2505',
  PHONE_HREF: 'tel:+27126672505',
  ADDRESS: 'Milestone Place Block A, 25 Sovereign Dr, Route 21 Business Park, Pretoria'
};

export const SECURITY_COLORS = {
  PRIMARY: '#6d28d9',
  PRIMARY_HOVER: '#5b21b6',
  SUCCESS: 'text-green-600',
  WARNING: 'text-amber-600',
  DANGER: 'text-red-600',
};
