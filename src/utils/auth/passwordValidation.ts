// Password Validation Utilities
// Financial-industry grade password requirements

// Common passwords to reject
const COMMON_PASSWORDS = [
  'password123',
  'password1234',
  '1234567890',
  '12345678901',
  '123456789012',
  'qwerty123',
  'qwerty1234',
  'qwerty12345',
  'letmein123',
  'welcome123',
  'admin123456',
  'password12345',
  'abcdef123456',
  'navigate123',
  'navigatewealth',
];

export interface PasswordStrength {
  isValid: boolean;
  score: number; // 0-4 (0=very weak, 4=very strong)
  feedback: string[];
  requirements: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecial: boolean;
    notCommon: boolean;
    characterTypes: number; // Must be >= 3
  };
}

export function validatePassword(password: string): PasswordStrength {
  const feedback: string[] = [];
  const requirements = {
    minLength: password.length >= 12,
    hasUppercase: /[A-Z]/.test(password),
    hasLowercase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
    hasSpecial: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
    notCommon: !COMMON_PASSWORDS.includes(password.toLowerCase()),
    characterTypes: 0,
  };

  // Count character types
  if (requirements.hasUppercase) requirements.characterTypes++;
  if (requirements.hasLowercase) requirements.characterTypes++;
  if (requirements.hasNumber) requirements.characterTypes++;
  if (requirements.hasSpecial) requirements.characterTypes++;

  // Check minimum length
  if (!requirements.minLength) {
    feedback.push('Password must be at least 12 characters long');
  }

  // Check character type diversity
  if (requirements.characterTypes < 3) {
    feedback.push('Password must contain at least 3 of: uppercase, lowercase, numbers, special characters');
  }

  // Check for common passwords
  if (!requirements.notCommon) {
    feedback.push('This password is too common. Please choose a more unique password');
  }

  // Calculate strength score (0-4)
  let score = 0;
  if (requirements.minLength) score++;
  if (requirements.characterTypes >= 3) score++;
  if (requirements.characterTypes === 4) score++;
  if (requirements.notCommon) score++;
  if (password.length >= 16) score++; // Bonus for extra length
  score = Math.min(score, 4); // Cap at 4

  // All requirements must pass
  const isValid = 
    requirements.minLength && 
    requirements.characterTypes >= 3 && 
    requirements.notCommon;

  // Add positive feedback for strong passwords
  if (isValid) {
    if (score >= 4) {
      feedback.push('✓ Very strong password');
    } else if (score === 3) {
      feedback.push('✓ Strong password');
    } else {
      feedback.push('✓ Password meets minimum requirements');
    }
  }

  return {
    isValid,
    score: Math.max(0, Math.min(score, 4)),
    feedback,
    requirements,
  };
}

export function getPasswordStrengthColor(score: number): string {
  switch (score) {
    case 0:
    case 1:
      return 'text-red-600';
    case 2:
      return 'text-orange-600';
    case 3:
      return 'text-yellow-600';
    case 4:
      return 'text-green-600';
    default:
      return 'text-gray-600';
  }
}

export function getPasswordStrengthLabel(score: number): string {
  switch (score) {
    case 0:
      return 'Very Weak';
    case 1:
      return 'Weak';
    case 2:
      return 'Fair';
    case 3:
      return 'Strong';
    case 4:
      return 'Very Strong';
    default:
      return 'Unknown';
  }
}

export function getPasswordStrengthBarWidth(score: number): string {
  return `${(score / 4) * 100}%`;
}
