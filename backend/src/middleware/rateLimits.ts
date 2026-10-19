import { rateLimit } from 'express-rate-limit';

/** Login, register and password recovery: per IP, against brute force and email flooding */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
});

/** Requests that call the AI provider: per user, to protect the quota */
export const aiLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 40,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: req => req.user!.userId,
  message: { error: 'Limite de uso da IA atingido. Tente novamente mais tarde.' },
});
