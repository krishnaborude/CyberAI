const path = require('node:path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function asPositiveInt(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Environment variable ${name} must be a positive integer.`);
  }
  return value;
}

function asStringList(name, fallback = []) {
  const raw = process.env[name];
  if (!raw || !raw.trim()) return fallback;
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  discord: {
    token: required('DISCORD_TOKEN'),
    clientId: required('DISCORD_CLIENT_ID'),
    guildId: process.env.DISCORD_GUILD_ID || null
  },
  serper: {
    // Optional. If missing, /labs will fall back to the local curated catalog.
    apiKeys: [
      process.env.SERPER_API_KEY ? process.env.SERPER_API_KEY.trim() : null,
      process.env.SERPER_API_KEY_2 ? process.env.SERPER_API_KEY_2.trim() : null,
      ...asStringList('SERPER_API_KEYS', [])
    ].filter(Boolean)
  },
  gemini: {
    apiKeys: [
      required('GEMINI_API_KEY'),
      process.env.GEMINI_API_KEY_2 ? process.env.GEMINI_API_KEY_2.trim() : null,
      ...asStringList('GEMINI_API_KEYS', [])
    ].filter(Boolean),
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash',
    fallbackModels: asStringList('GEMINI_FALLBACK_MODELS', []),
    maxRetries: asPositiveInt('GEMINI_MAX_RETRIES', 3),
    retryBaseMs: asPositiveInt('GEMINI_RETRY_BASE_MS', 1500)
  },
  rateLimit: {
    windowMs: asPositiveInt('RATE_LIMIT_WINDOW_MS', 60_000),
    maxRequests: asPositiveInt('RATE_LIMIT_MAX_REQUESTS', 6)
  },
  limits: {
    maxPromptChars: asPositiveInt('MAX_PROMPT_CHARS', 1200)
  }
};

module.exports = config;
