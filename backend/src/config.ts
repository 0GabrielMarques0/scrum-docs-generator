import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= 32) return secret;

  if (isProduction) {
    throw new Error('JWT_SECRET must be set (min. 32 characters) in production');
  }

  // Dev only: random secret per process, so sessions reset on restart but are never forgeable
  console.warn('⚠️  JWT_SECRET missing or too short - using a random secret for this dev session');
  return crypto.randomBytes(48).toString('hex');
}

function resolveAllowedOrigins(): string[] {
  const origins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map(origin => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);

  if (origins.length > 0) return origins;
  if (isProduction) {
    throw new Error('FRONTEND_URL must be set in production (comma-separated list allowed)');
  }
  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 3001,
  jwtSecret: resolveJwtSecret(),
  jwtExpiresIn: '7d' as const,
  allowedOrigins: resolveAllowedOrigins(),
  /** Public URL of the frontend, used to build links sent by email */
  frontendUrl: resolveAllowedOrigins()[0],
  passwordResetTtlMinutes: 60,
  ai: {
    /** 'gemini' (Google, free tier) or 'anthropic' (Claude API, paid) */
    provider: (process.env.AI_PROVIDER === 'anthropic' ? 'anthropic' : 'gemini') as 'gemini' | 'anthropic',
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    // Set GEMINI_FALLBACK_MODEL= (empty) to disable
    geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL ?? 'gemini-flash-lite-latest',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
  },
  maxImagesPerScreen: 10,
};
