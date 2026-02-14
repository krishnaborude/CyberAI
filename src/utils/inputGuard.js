const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/i,
  /reveal\s+(the\s+)?(system|developer|hidden)\s+prompt/i,
  /jailbreak/i,
  /bypass\s+(rules|safety|restrictions)/i,
  /act\s+as\s+an?\s+unrestricted/i,
  /disable\s+(guardrails|safety|filters)/i,
  /developer\s+mode/i
];

const AUTHORIZED_SCOPE_PATTERNS = [
  /\bauthorized\b/i,
  /\bpermission\b/i,
  /\bconsent\b/i,
  /\blab\b/i,
  /\bctf\b/i,
  /\btryhackme\b/i,
  /\bhack\s*the\s*box\b/i,
  /\bhtb\b/i,
  /\bsandbox\b/i,
  /\btraining\b/i,
  /\bvulnhub\b/i,
  /\bdvwa\b/i,
  /\bmetasploitable\b/i,
  /\binternal\s+(test|assessment|environment)\b/i,
  /\bowned\s+asset\b/i
];

function sanitizeUserInput(input, { maxChars = 1200 } = {}) {
  if (typeof input !== 'string') return '';

  const normalized = input
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxChars)
    .replace(/@everyone/gi, '@ everyone')
    .replace(/@here/gi, '@ here');

  return normalized;
}

function hasPromptInjection(input) {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(input));
}

function validateUserInput(input, { required = false } = {}) {
  if (!input && required) {
    return { valid: false, reason: 'Please provide a value for this command.' };
  }

  if (input && input.length < 2) {
    return { valid: false, reason: 'Input is too short. Provide at least 2 characters.' };
  }

  return { valid: true, reason: null };
}

function hasAuthorizedScopeEvidence(input) {
  if (typeof input !== 'string' || !input.trim()) return false;
  return AUTHORIZED_SCOPE_PATTERNS.some((pattern) => pattern.test(input));
}

module.exports = {
  sanitizeUserInput,
  hasPromptInjection,
  validateUserInput,
  hasAuthorizedScopeEvidence
};
