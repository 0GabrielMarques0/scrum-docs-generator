import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { RowDataPacket } from 'mysql2';
import { db } from '../database/init.js';
import { config } from '../config.js';
import { sendPasswordResetEmail } from '../services/email.service.js';
import { authMiddleware, getUserId, signToken } from '../middleware/auth.js';
import { asyncHandler, HttpError } from '../middleware/errors.js';
import { assertStrongPassword, normalizeEmail, requireString } from '../utils/validation.js';

const router = Router();

const BCRYPT_ROUNDS = 12;
// Compared against when the email doesn't exist, so response time doesn't reveal registered emails
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', BCRYPT_ROUNDS);

interface UserRow extends RowDataPacket {
  id: string;
  email: string;
  password: string;
  name: string;
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login do usuário
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string }
 *               password: { type: string }
 *     responses:
 *       200: { description: Login bem sucedido }
 *       401: { description: Credenciais inválidas }
 */
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    throw new HttpError(400, 'Email e senha são obrigatórios');
  }

  const [rows] = await db.execute<UserRow[]>(
    'SELECT * FROM users WHERE LOWER(email) = ?',
    [email.trim().toLowerCase()]
  );
  const user = rows[0];
  const isValidPassword = await bcrypt.compare(password, user?.password ?? DUMMY_HASH);

  if (!user || !isValidPassword) {
    throw new HttpError(401, 'Email ou senha inválidos');
  }

  res.json({
    token: signToken({ userId: user.id, email: user.email }),
    user: { id: user.id, email: user.email, name: user.name },
  });
}));

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Cadastrar novo usuário
 *     tags: [Auth]
 *     responses:
 *       201: { description: Usuário criado com sucesso }
 *       409: { description: Email já cadastrado }
 */
router.post('/register', asyncHandler(async (req, res) => {
  const name = requireString(req.body?.name, 'Nome', 255);
  const email = normalizeEmail(req.body?.email);
  const { password } = req.body ?? {};
  assertStrongPassword(password);

  const [existing] = await db.execute<RowDataPacket[]>(
    'SELECT id FROM users WHERE LOWER(email) = ?',
    [email]
  );
  if (existing.length > 0) {
    throw new HttpError(409, 'Email já cadastrado');
  }

  const id = `user_${crypto.randomUUID()}`;
  const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

  await db.execute(
    'INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)',
    [id, email, hashedPassword, name]
  );

  res.status(201).json({ message: 'Usuário criado com sucesso', user: { id, email, name } });
}));

router.get('/me', authMiddleware, asyncHandler(async (req, res) => {
  const [rows] = await db.execute<RowDataPacket[]>(
    'SELECT id, email, name, created_at FROM users WHERE id = ?',
    [getUserId(req)]
  );

  if (rows.length === 0) throw new HttpError(404, 'Usuário não encontrado');
  res.json(rows[0]);
}));

/**
 * POST /api/auth/forgot-password
 * Sends a single-use reset link. The current password stays valid until the link is used,
 * so nobody can lock another user out just by knowing their email.
 */
router.post('/forgot-password', asyncHandler(async (req, res) => {
  const genericResponse = { message: 'Se o email estiver cadastrado, você receberá um link para redefinir a senha' };
  const email = normalizeEmail(req.body?.email);

  const [rows] = await db.execute<UserRow[]>(
    'SELECT id, email, name FROM users WHERE LOWER(email) = ?',
    [email]
  );
  const user = rows[0];
  if (!user) return res.json(genericResponse);

  const token = crypto.randomBytes(32).toString('hex');

  // Only the latest link is valid. Expiry is computed by MySQL so it matches the NOW() check on reset.
  await db.execute('DELETE FROM password_resets WHERE user_id = ?', [user.id]);
  await db.execute(
    'INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))',
    [hashToken(token), user.id, config.passwordResetTtlMinutes]
  );

  const resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
  const emailSent = await sendPasswordResetEmail(user.email, user.name, resetUrl);

  if (!emailSent && !config.isProduction) {
    console.log(`[DEV] Password reset link for ${user.email}: ${resetUrl}`);
  }

  res.json(genericResponse);
}));

/**
 * POST /api/auth/reset-password
 * Sets a new password using the token received by email.
 */
router.post('/reset-password', asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body ?? {};
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) {
    throw new HttpError(400, 'Link inválido ou expirado');
  }
  assertStrongPassword(newPassword);

  const [rows] = await db.execute<RowDataPacket[]>(
    `SELECT user_id FROM password_resets
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW()`,
    [hashToken(token)]
  );
  if (rows.length === 0) throw new HttpError(400, 'Link inválido ou expirado');

  const userId = rows[0].user_id as string;
  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
  await db.execute('DELETE FROM password_resets WHERE user_id = ?', [userId]);

  res.json({ message: 'Senha redefinida com sucesso' });
}));

router.post('/change-password', authMiddleware, asyncHandler(async (req, res) => {
  const userId = getUserId(req);
  const { currentPassword, newPassword } = req.body ?? {};

  if (typeof currentPassword !== 'string' || !currentPassword) {
    throw new HttpError(400, 'Senha atual e nova senha são obrigatórias');
  }
  assertStrongPassword(newPassword);

  const [rows] = await db.execute<UserRow[]>('SELECT * FROM users WHERE id = ?', [userId]);
  if (rows.length === 0) throw new HttpError(404, 'Usuário não encontrado');

  if (!(await bcrypt.compare(currentPassword, rows[0].password))) {
    throw new HttpError(401, 'Senha atual incorreta');
  }

  const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);

  res.json({ message: 'Senha alterada com sucesso' });
}));

export const authRoutes = router;
