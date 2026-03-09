export const PASSWORD_MIN_LENGTH = 12;

export interface PasswordValidationResult {
  valid: boolean;
  minLengthMet: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
}

export const validatePasswordPolicy = (password: string): PasswordValidationResult => {
  const minLengthMet = password.length >= PASSWORD_MIN_LENGTH;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);

  return {
    valid: minLengthMet && hasUppercase && hasLowercase && hasNumber,
    minLengthMet,
    hasUppercase,
    hasLowercase,
    hasNumber,
  };
};

export const getPasswordPolicyMessage = () => 'Use at least 12 characters with uppercase, lowercase, and a number.';
