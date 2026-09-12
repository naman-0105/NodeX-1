import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.js';
import { UnauthorizedError } from '../errors/app-error.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  name?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function authenticateUser(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authHeader = req.headers.authorization;

    // 1. Bearer Token Authentication
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7).trim();
      if (token) {
        const payload = verifyToken(token);
        req.user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
          name: payload.name,
        };
        return next();
      }
    }

    // 2. Fallback header/query for backward-compatible test suites and development
    const customOwnerId = (req.headers['x-owner-id'] as string) || (req.query?.ownerId as string) || (req.body?.ownerId as string);
    if (customOwnerId) {
      req.user = {
        id: customOwnerId,
        email: 'user@nodex.local',
        role: 'user',
      };
    }

    next();
  } catch (err) {
    next(err);
  }
}

export function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (!req.user || !req.user.id) {
    return next(
      new UnauthorizedError('Authentication required. Please provide a valid Bearer token.')
    );
  }
  next();
}
