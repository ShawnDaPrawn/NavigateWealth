// Server-side Password Validation
// Enforces strong password requirements to prevent weak passwords

// Common passwords that should be rejected
const COMMON_PASSWORDS = [
  'password', 'password123', 'password1234', '12345678', '123456789', '1234567890',
  'qwerty', 'qwerty123', 'qwerty1234', 'abc123', 'letmein', 'welcome', 'admin',
  'root', 'toor', 'pass', 'test', 'guest', 'info', 'adm', 'mysql', 'user',
  'administrator', 'oracle', 'ftp', 'pi', 'puppet', 'ansible', 'ec2-user',
  'vagrant', 'azureuser', 'ubuntu', 'demo', 'navigate', 'navigatewealth',
  'wealth', 'finance', 'admin123456', 'password12345', 'abcdef123456',
];

export interface PasswordValidationResult {
  isValid: boolean;
  errors: string[];
  strength: 'very_weak' | 'weak' | 'fair' | 'strong' | 'very_strong';
}

/**
 * Validate password against security requirements
 * Requirements:
 * - Minimum 12 characters
 * - At least 3 of: uppercase, lowercase, numbers, special characters
 * - Not a common password
 * - Not contain sequential characters (123, abc)
 */
export function validatePassword(password: string): PasswordValidationResult {
  const errors: string[] = [];
  
  // Check minimum length
  if (password.length < 12) {
    errors.push('Password must be at least 12 characters long');
  }
  
  // Check character types
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
  
  const characterTypes = [hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;
  
  if (characterTypes < 3) {
    errors.push('Password must contain at least 3 of: uppercase letters, lowercase letters, numbers, special characters');
  }
  
  // Check for common passwords
  const lowerPassword = password.toLowerCase();
  if (COMMON_PASSWORDS.some(common => lowerPassword.includes(common))) {
    errors.push('Password is too common or contains common words. Please choose a more unique password');
  }
  
  // Check for sequential characters
  if (/012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz/i.test(password)) {
    errors.push('Password should not contain sequential characters (e.g., 123, abc)');
  }
  
  // Check for repeated characters
  if (/(.)\1{2,}/.test(password)) {
    errors.push('Password should not contain repeated characters (e.g., aaa, 111)');
  }
  
  // Calculate strength
  let strengthScore = 0;
  if (password.length >= 12) strengthScore++;
  if (password.length >= 16) strengthScore++;
  if (characterTypes >= 3) strengthScore++;
  if (characterTypes === 4) strengthScore++;
  if (!COMMON_PASSWORDS.some(common => lowerPassword.includes(common))) strengthScore++;
  
  const strength: PasswordValidationResult['strength'] = 
    strengthScore <= 1 ? 'very_weak' :
    strengthScore === 2 ? 'weak' :
    strengthScore === 3 ? 'fair' :
    strengthScore === 4 ? 'strong' : 'very_strong';
  
  return {
    isValid: errors.length === 0,
    errors,
    strength,
  };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): { isValid: boolean; error?: string } {
  if (!email || typeof email !== 'string') {
    return { isValid: false, error: 'Email is required' };
  }
  
  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, error: 'Invalid email format' };
  }
  
  // Check for suspicious patterns
  if (email.includes('..') || email.startsWith('.') || email.endsWith('.')) {
    return { isValid: false, error: 'Invalid email format' };
  }
  
  // Max length check
  if (email.length > 254) {
    return { isValid: false, error: 'Email is too long' };
  }
  
  return { isValid: true };
}

/**
 * Validate phone number format
 */
export function validatePhoneNumber(phoneNumber: string, countryCode: string): { isValid: boolean; error?: string } {
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return { isValid: false, error: 'Phone number is required' };
  }
  
  // Remove spaces and dashes
  const cleaned = phoneNumber.replace(/[\s\-]/g, '');
  
  // Check if it contains only digits
  if (!/^\d+$/.test(cleaned)) {
    return { isValid: false, error: 'Phone number should contain only digits' };
  }
  
  // Check reasonable length (6-15 digits)
  if (cleaned.length < 6 || cleaned.length > 15) {
    return { isValid: false, error: 'Phone number length is invalid' };
  }
  
  return { isValid: true };
}

/**
 * Sanitize input to prevent injection attacks
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';
  
  // Remove any potential script tags or dangerous characters
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}
