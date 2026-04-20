export const REQUIRE_NHS_NET_PRACTICE_EMAILS = false;

export const validatePracticeContactEmail = (email: string, requireNhsNet = REQUIRE_NHS_NET_PRACTICE_EMAILS) => {
  const trimmed = email.trim();

  if (!trimmed) {
    return 'Contact email is required';
  }

  if (requireNhsNet && !trimmed.toLowerCase().endsWith('@nhs.net')) {
    return 'Only nhs.net email addresses are accepted';
  }

  return '';
};
