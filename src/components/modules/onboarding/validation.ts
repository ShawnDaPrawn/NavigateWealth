import { ApplicationData } from './types';

export function validateStep(step: number, data: ApplicationData): string[] {
  const errors: string[] = [];

  switch (step) {
    case 1:
      if (!data.title) errors.push('Please select a title');
      if (!data.firstName.trim()) errors.push('First name is required');
      if (!data.lastName.trim()) errors.push('Last name is required');
      if (!data.dateOfBirth) errors.push('Date of birth is required');
      if (!data.gender) errors.push('Please select your gender');
      if (!data.nationality) errors.push('Nationality is required');
      if (!data.idType) errors.push('Please select an identification type');
      if (data.idType && !data.idNumber.trim()) errors.push('ID / Passport number is required');
      if (data.idType === 'sa_id' && data.idNumber.trim() && !/^\d{13}$/.test(data.idNumber.trim())) {
        errors.push('SA ID number must be exactly 13 digits');
      }
      if (!data.maritalStatus) errors.push('Please select your marital status');
      if ((data.maritalStatus === 'Married' || data.maritalStatus === 'Life Partner') && !data.maritalRegime) {
        errors.push('Please select your marital regime');
      }
      break;

    case 2:
      if (!data.emailAddress.trim()) errors.push('Email address is required');
      if (data.emailAddress.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.emailAddress.trim())) {
        errors.push('Please enter a valid email address');
      }
      if (!data.cellphoneNumber.trim()) errors.push('Cellphone number is required');
      if (!data.residentialAddressLine1.trim()) errors.push('Residential address is required');
      if (!data.residentialCity.trim()) errors.push('City is required');
      if (!data.residentialProvince.trim()) errors.push('State / Province / Region is required');
      if (!data.residentialPostalCode.trim()) errors.push('Postal / ZIP code is required');
      if (!data.residentialCountry.trim()) errors.push('Country is required');
      break;

    case 3:
      if (!data.employmentStatus) errors.push('Please select your employment status');
      if (data.employmentStatus === 'employed' || data.employmentStatus === 'contract') {
        if (!data.jobTitle.trim()) errors.push('Job title is required');
        if (!data.employerName.trim()) errors.push('Employer name is required');
        if (!data.industry) errors.push('Industry is required');
        if (data.industry === 'Other' && !data.industryOther?.trim()) errors.push('Please specify your industry');
      }
      if (data.employmentStatus === 'self-employed') {
        if (!data.selfEmployedIndustry) errors.push('Industry is required');
        if (data.selfEmployedIndustry === 'Other' && !data.selfEmployedIndustryOther?.trim()) errors.push('Please specify your industry');
        if (!data.selfEmployedDescription.trim()) errors.push('Business description is required');
      }
      break;

    case 4:
      if (data.accountReasons.length === 0) {
        errors.push('Please select at least one service you are interested in');
      }
      if (data.accountReasons.includes('Other') && !data.otherReason.trim()) {
        errors.push('Please specify your reason');
      }
      if (!data.urgency) {
        errors.push('Please indicate how soon you would like to get started');
      }
      break;

    case 5:
      if (!data.termsAccepted) errors.push('You must accept the Terms and Conditions');
      if (!data.popiaConsent) errors.push('You must provide POPIA consent');
      if (!data.disclosureAcknowledged) errors.push('You must acknowledge the disclosure statement');
      if (!data.faisAcknowledged) errors.push('You must acknowledge the FAIS disclosure');
      if (!data.signatureFullName.trim()) {
        errors.push('Please type your full name as a digital signature');
      } else {
        // Signature must match the applicant's full legal name (excluding title)
        const expectedName = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ');
        if (data.signatureFullName.trim().toLowerCase() !== expectedName.trim().toLowerCase()) {
          errors.push(`Your signature must exactly match your full name: ${expectedName}`);
        }
      }
      break;
  }

  return errors;
}