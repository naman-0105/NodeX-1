import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as authService from '../services/auth.js';
import { UnauthorizedError } from '../errors/app-error.js';

export const registerSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  name: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email('Valid email address is required'),
  password: z.string().min(1, 'Password is required'),
});

export const googleCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  redirectUri: z.string().optional(),
});

export async function registerHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password, name } = req.body;
    const result = await authService.register(email, password, name);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function loginHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getGoogleAuthUrlHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const redirectUri = req.query.redirect_uri as string | undefined;
    const info = authService.getGoogleAuthUrl(redirectUri);
    res.json(info);
  } catch (err) {
    next(err);
  }
}

export async function googleCallbackHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const code = (req.body?.code || req.query?.code) as string;
    const redirectUri = (req.body?.redirectUri || req.query?.redirect_uri) as string | undefined;

    if (!code) {
      res.status(400).json({ error: { message: 'Missing authorization code' } });
      return;
    }

    const result = await authService.handleGoogleCallback(code, redirectUri);

    // If invoked via browser direct redirect, send an HTML popup message listener or json
    if (req.headers.accept?.includes('text/html')) {
      res.send(`
        <!DOCTYPE html>
        <html>
        <head><title>Authentication Successful</title></head>
        <body style="font-family: system-ui, sans-serif; text-align: center; padding: 40px; background: #f8fafc; color: #0f172a;">
          <h3 style="color: #16a34a;">Authentication Successful!</h3>
          <p>Redirecting back to NodeX...</p>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'GOOGLE_AUTH_SUCCESS', token: '${result.token}', user: ${JSON.stringify(result.user)} }, '*');
              window.close();
            } else {
              localStorage.setItem('nodex_auth_token', '${result.token}');
              window.location.href = '/';
            }
          </script>
        </body>
        </html>
      `);
      return;
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getCurrentUserHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new UnauthorizedError('Not authenticated');
    }
    const user = await authService.getCurrentUser(userId);
    res.json({ user });
  } catch (err) {
    next(err);
  }
}
