import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { db } from '../database/init.js';
import { AuthUser, ProjectRow } from '../types/index.js';
import { HttpError, asyncHandler } from './errors.js';

export function signToken(user: AuthUser): string {
  return jwt.sign(user, config.jwtSecret, { expiresIn: config.jwtExpiresIn, algorithm: 'HS256' });
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  try {
    const decoded = jwt.verify(authHeader.substring(7), config.jwtSecret, { algorithms: ['HS256'] }) as AuthUser;
    if (!decoded.userId) throw new Error('Invalid payload');
    req.user = { userId: decoded.userId, email: decoded.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

/** Returns the authenticated user id (routes behind authMiddleware only) */
export function getUserId(req: Request): string {
  if (!req.user) throw new HttpError(401, 'Não autenticado');
  return req.user.userId;
}

/**
 * Loads the project from the `:projectId` (or `:id`) param and checks that it belongs
 * to the authenticated user. Every project-scoped route must go through it.
 */
export const loadOwnedProject = asyncHandler(async (req, _res, next) => {
  const projectId = req.params.projectId || req.params.id;
  const [rows] = await db.execute<ProjectRow[]>(
    'SELECT * FROM projects WHERE id = ? AND user_id = ?',
    [projectId, getUserId(req)]
  );

  if (rows.length === 0) throw new HttpError(404, 'Projeto não encontrado');
  req.project = rows[0];
  next();
});

export function getProject(req: Request): ProjectRow {
  if (!req.project) throw new HttpError(500, 'Projeto não carregado');
  return req.project;
}
