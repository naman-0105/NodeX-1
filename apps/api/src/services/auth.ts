import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as userRepo from '../repositories/users.js';
import { BadRequestError, UnauthorizedError, ConflictError } from '../errors/app-error.js';
import type { User } from '@nodex/db';

const JWT_SECRET = process.env.JWT_SECRET || 'nodex-production-jwt-secret-key-2026';
const JWT_EXPIRES_IN = '7d';

export interface UserSummary {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  authProvider: string;
  createdAt: string;
}

export interface AuthResult {
  user: UserSummary;
  token: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  name?: string | null;
}

export function formatUserSummary(user: User): UserSummary {
  return {
    id: user.id,
    email: user.email,
    name: user.name || null,
    avatarUrl: user.avatarUrl || null,
    role: user.role,
    authProvider: user.authProvider,
    createdAt: user.createdAt.toISOString(),
  };
}

export function signToken(user: User): string {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch (err: any) {
    throw new UnauthorizedError(`Invalid or expired authentication token: ${err.message}`);
  }
}

export async function register(
  email: string,
  password: string,
  name?: string
): Promise<AuthResult> {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Check if user already exists
  const existing = await userRepo.findUserByEmail(normalizedEmail);
  if (existing) {
    throw new ConflictError(`User with email "${normalizedEmail}" already exists`);
  }

  // 2. Hash password with bcrypt
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // 3. Create user in DB
  const user = await userRepo.createUser({
    email: normalizedEmail,
    passwordHash,
    name: name?.trim() || null,
    role: 'user',
    authProvider: 'local',
  });

  const token = signToken(user);
  return {
    user: formatUserSummary(user),
    token,
  };
}

export async function login(
  email: string,
  password: string
): Promise<AuthResult> {
  const normalizedEmail = email.toLowerCase().trim();

  // 1. Find user by email
  const user = await userRepo.findUserByEmail(normalizedEmail);
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // 2. If user registered via OAuth without local password
  if (!user.passwordHash) {
    throw new UnauthorizedError(
      `This account was created with ${user.authProvider}. Please sign in using ${user.authProvider}.`
    );
  }

  // 3. Verify password
  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const token = signToken(user);
  return {
    user: formatUserSummary(user),
    token,
  };
}

export function getGoogleAuthUrl(customRedirectUri?: string): { url: string; configured: boolean } {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = customRedirectUri || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/auth/callback';

  if (!clientId) {
    return {
      url: '',
      configured: false,
    };
  }

  const scopes = ['openid', 'email', 'profile'].join(' ');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: scopes,
    access_type: 'offline',
    prompt: 'consent',
  });

  return {
    url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
    configured: true,
  };
}

export async function handleGoogleCallback(
  code: string,
  customRedirectUri?: string
): Promise<AuthResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = customRedirectUri || process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/auth/callback';

  if (!clientId || !clientSecret) {
    throw new BadRequestError(
      'Google OAuth is not configured on this server. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.'
    );
  }

  // 1. Exchange code for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    throw new BadRequestError(`Google OAuth token exchange failed: ${errBody}`);
  }

  const tokenData = (await tokenRes.json()) as { access_token: string; id_token?: string };

  // 2. Fetch user profile from Google UserInfo endpoint
  const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!userinfoRes.ok) {
    const errBody = await userinfoRes.text();
    throw new BadRequestError(`Failed to fetch Google user profile: ${errBody}`);
  }

  const profile = (await userinfoRes.json()) as {
    sub: string;
    email: string;
    name?: string;
    picture?: string;
  };

  if (!profile.email) {
    throw new BadRequestError('Google OAuth profile does not include an email address.');
  }

  // 3. Upsert user in database
  const user = await userRepo.upsertGoogleUser({
    googleId: profile.sub,
    email: profile.email,
    name: profile.name,
    avatarUrl: profile.picture,
  });

  const token = signToken(user);
  return {
    user: formatUserSummary(user),
    token,
  };
}

export async function getCurrentUser(userId: string): Promise<UserSummary> {
  const user = await userRepo.findUserById(userId);
  if (!user) {
    throw new UnauthorizedError('User not found');
  }
  return formatUserSummary(user);
}
