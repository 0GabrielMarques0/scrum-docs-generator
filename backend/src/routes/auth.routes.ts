import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../database/init.js';
import { RowDataPacket } from 'mysql2';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'scrum-docs-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

interface User {
  id: string;
  email: string;
  password: string;
  name: string;
}

// Middleware to verify JWT token
export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email: string };
    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
};

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
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@email.com
 *               password:
 *                 type: string
 *                 example: "123456"
 *     responses:
 *       200:
 *         description: Login bem sucedido
 *       401:
 *         description: Credenciais inválidas
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Find user by email
    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    const user = rows[0] as User;

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Email ou senha inválidos' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro ao fazer login' });
  }
});

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Cadastrar novo usuário
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *                 example: user@email.com
 *               password:
 *                 type: string
 *                 example: "123456"
 *               name:
 *                 type: string
 *                 example: "João Silva"
 *     responses:
 *       201:
 *         description: Usuário criado com sucesso
 *       409:
 *         description: Email já cadastrado
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, senha e nome são obrigatórios' });
    }

    // Check if email already exists
    const [existing] = await db.execute<RowDataPacket[]>(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({ error: 'Email já cadastrado' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate unique ID
    const id = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Insert user
    await db.execute(
      'INSERT INTO users (id, email, password, name) VALUES (?, ?, ?, ?)',
      [id, email, hashedPassword, name]
    );

    res.status(201).json({
      message: 'Usuário criado com sucesso',
      user: { id, email, name },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Erro ao cadastrar usuário' });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 */
router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { userId } = (req as any).user;

    const [rows] = await db.execute<RowDataPacket[]>(
      'SELECT id, email, name, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Erro ao buscar usuário' });
  }
});

export const authRoutes = router;
