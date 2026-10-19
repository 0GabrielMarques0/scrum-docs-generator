import { HttpError } from '../middleware/errors.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string {
  if (typeof value !== 'string' || !EMAIL_REGEX.test(value.trim()) || value.length > 255) {
    throw new HttpError(400, 'Email inválido');
  }
  return value.trim().toLowerCase();
}

/** Same rules shown in the register / change-password forms */
export function assertStrongPassword(password: unknown): asserts password is string {
  if (typeof password !== 'string') throw new HttpError(400, 'Senha é obrigatória');
  if (password.length < 8) throw new HttpError(400, 'A senha deve ter pelo menos 8 caracteres');
  if (password.length > 128) throw new HttpError(400, 'A senha deve ter no máximo 128 caracteres');
  if (!/[A-Z]/.test(password)) throw new HttpError(400, 'A senha deve conter pelo menos uma letra maiúscula');
  if (!/[a-z]/.test(password)) throw new HttpError(400, 'A senha deve conter pelo menos uma letra minúscula');
  if (!/[0-9]/.test(password)) throw new HttpError(400, 'A senha deve conter pelo menos um número');
}

export function requireString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `${field} é obrigatório`);
  }
  const trimmed = value.trim();
  if (trimmed.length > maxLength) {
    throw new HttpError(400, `${field} deve ter no máximo ${maxLength} caracteres`);
  }
  return trimmed;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Safe value for a Content-Disposition filename */
export function toFileName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 80) || 'documento';
}
