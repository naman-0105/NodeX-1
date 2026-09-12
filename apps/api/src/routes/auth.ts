import { Router, type Router as RouterType } from 'express';
import {
  registerHandler,
  loginHandler,
  getGoogleAuthUrlHandler,
  googleCallbackHandler,
  getCurrentUserHandler,
  registerSchema,
  loginSchema,
} from '../controllers/auth.js';
import { validateBody } from '../middleware/validate.js';
import { authenticateUser, requireAuth } from '../middleware/auth.js';

export const authRouter: RouterType = Router();

// Local Password Authentication
authRouter.post('/register', validateBody(registerSchema), registerHandler);
authRouter.post('/login', validateBody(loginSchema), loginHandler);

// Google OAuth2
authRouter.get('/google/url', getGoogleAuthUrlHandler);
authRouter.get('/google/callback', googleCallbackHandler);
authRouter.post('/google/callback', googleCallbackHandler);

// Current User Profile
authRouter.get('/me', authenticateUser, requireAuth, getCurrentUserHandler);
