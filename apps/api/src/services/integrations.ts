import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { encrypt, decrypt } from '@nodex/db';
import * as credentialsRepo from '../repositories/credentials.js';
import { AppError, ValidationError } from '../errors/app-error.js';

// Ensure .env is loaded from workspace root
let currentDir = process.cwd();
for (let i = 0; i < 4; i++) {
  const envPath = path.join(currentDir, '.env');
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  }
  const parent = path.dirname(currentDir);
  if (parent === currentDir) break;
  currentDir = parent;
}

export interface SlackChannel {
  readonly id: string;
  readonly name: string;
  readonly isPrivate?: boolean;
}

export interface SlackCredentialPayload {
  readonly accessToken: string;
  readonly teamId?: string;
  readonly teamName?: string;
  readonly authedUserId?: string;
  readonly scope?: string;
  readonly botUserId?: string;
}

const DEFAULT_SLACK_SCOPES = [
  'chat:write',
  'channels:read',
  'groups:read',
  'im:read',
  'mpim:read',
].join(',');

export async function getSlackAuthorizeUrl(
  ownerId: string = '00000000-0000-0000-0000-000000000001',
  customRedirectUri?: string
): Promise<{ url: string; configured: boolean; message?: string }> {
  const clientId = process.env.SLACK_CLIENT_ID;
  const redirectUri =
    customRedirectUri ||
    process.env.SLACK_REDIRECT_URI ||
    'http://localhost:3000/api/integrations/slack/callback';

  if (!clientId) {
    return {
      url: '',
      configured: false,
      message:
        'SLACK_CLIENT_ID is not configured in .env. Please configure SLACK_CLIENT_ID and SLACK_CLIENT_SECRET or use a Bot User Token directly.',
    };
  }

  const state = Buffer.from(JSON.stringify({ ownerId, redirectUri })).toString('base64');
  const params = new URLSearchParams({
    client_id: clientId,
    scope: DEFAULT_SLACK_SCOPES,
    redirect_uri: redirectUri,
    state,
  });

  return {
    url: `https://slack.com/oauth/v2/authorize?${params.toString()}`,
    configured: true,
  };
}

export async function exchangeSlackCode(
  code: string,
  ownerId: string = '00000000-0000-0000-0000-000000000001',
  customRedirectUri?: string
): Promise<SlackCredentialPayload> {
  if (!code) {
    throw new ValidationError('OAuth code is required');
  }

  // Handle mock / test code for local development and integration tests
  if (code.startsWith('mock_') || code.startsWith('test_')) {
    const mockPayload: SlackCredentialPayload = {
      accessToken: 'xoxb-mock-slack-access-token-12345',
      teamId: 'T00000000',
      teamName: 'Development Workspace',
      authedUserId: 'U00000000',
      scope: DEFAULT_SLACK_SCOPES,
    };

    const encrypted = encrypt(JSON.stringify(mockPayload));
    await credentialsRepo.saveCredential(ownerId, 'slack', encrypted);
    return mockPayload;
  }

  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri =
    customRedirectUri ||
    process.env.SLACK_REDIRECT_URI ||
    'http://localhost:3000/api/integrations/slack/callback';

  if (!clientId || !clientSecret) {
    throw new AppError(
      'SLACK_CLIENT_ID and SLACK_CLIENT_SECRET must be configured in environment variables to exchange real OAuth codes',
      500,
      'SLACK_CONFIG_MISSING'
    );
  }

  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const data = (await response.json()) as any;

  if (!data.ok) {
    throw new ValidationError(`Slack OAuth exchange failed: ${data.error || 'Unknown error'}`, {
      details: data,
    });
  }

  const payload: SlackCredentialPayload = {
    accessToken: data.access_token,
    teamId: data.team?.id,
    teamName: data.team?.name,
    authedUserId: data.authed_user?.id,
    scope: data.scope,
    botUserId: data.bot_user_id,
  };

  const encrypted = encrypt(JSON.stringify(payload));
  await credentialsRepo.saveCredential(ownerId, 'slack', encrypted);

  return payload;
}

export async function saveDirectSlackToken(
  ownerId: string = '00000000-0000-0000-0000-000000000001',
  token: string
): Promise<void> {
  if (!token || !token.trim()) {
    throw new ValidationError('Slack token is required');
  }

  const payload: SlackCredentialPayload = {
    accessToken: token.trim(),
    teamName: 'Manual Bot Integration',
  };

  const encrypted = encrypt(JSON.stringify(payload));
  await credentialsRepo.saveCredential(ownerId, 'slack', encrypted);
}

export async function getSlackChannels(
  ownerId: string = '00000000-0000-0000-0000-000000000001'
): Promise<SlackChannel[]> {
  const cred = await credentialsRepo.findCredential(ownerId, 'slack');

  if (!cred) {
    // Return mock channels if no credential exists so frontend UI can render previews in dev
    return [
      { id: 'C_GENERAL', name: 'general' },
      { id: 'C_RANDOM', name: 'random' },
      { id: 'C_ALERTS', name: 'alerts' },
    ];
  }

  let accessToken: string;
  try {
    const decryptedStr = decrypt(cred.encryptedData);
    let parsed: any;
    try {
      parsed = JSON.parse(decryptedStr);
    } catch {
      parsed = { accessToken: decryptedStr };
    }
    accessToken = parsed.accessToken || decryptedStr;
  } catch (err: any) {
    console.error('Failed to decrypt Slack token:', err);
    return [
      { id: 'C_GENERAL', name: 'general' },
      { id: 'C_RANDOM', name: 'random' },
    ];
  }

  // Handle mock tokens
  if (accessToken.startsWith('xoxb-mock-') || accessToken.startsWith('mock_')) {
    return [
      { id: 'C_GENERAL', name: 'general' },
      { id: 'C_RANDOM', name: 'random' },
      { id: 'C_NOTIFICATIONS', name: 'notifications' },
      { id: 'C_DEPLOYMENTS', name: 'deployments' },
      { id: 'C_INCIDENTS', name: 'incidents' },
    ];
  }

  try {
    const response = await fetch(
      'https://slack.com/api/conversations.list?types=public_channel,private_channel&exclude_archived=true&limit=100',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = (await response.json()) as any;

    if (!data.ok || !Array.isArray(data.channels)) {
      console.warn('Slack conversations.list returned non-ok response:', data.error);
      return [
        { id: 'general', name: 'general' },
        { id: 'random', name: 'random' },
      ];
    }

    return data.channels.map((ch: any) => ({
      id: ch.id,
      name: ch.name || ch.id,
      isPrivate: Boolean(ch.is_private),
    }));
  } catch (err: any) {
    console.error('Failed to fetch Slack channels from Slack API:', err);
    return [
      { id: 'general', name: 'general' },
      { id: 'random', name: 'random' },
    ];
  }
}

export async function getIntegrationStatus(
  ownerId: string = '00000000-0000-0000-0000-000000000001'
): Promise<{
  slack: {
    connected: boolean;
    teamName?: string;
    updatedAt?: string;
  };
}> {
  const slackCred = await credentialsRepo.findCredential(ownerId, 'slack');

  if (!slackCred) {
    return {
      slack: {
        connected: false,
      },
    };
  }

  let teamName: string | undefined;
  try {
    const decrypted = decrypt(slackCred.encryptedData);
    const parsed = JSON.parse(decrypted);
    teamName = parsed.teamName;
  } catch {
    // Ignore parse error
  }

  return {
    slack: {
      connected: true,
      teamName,
      updatedAt: slackCred.updatedAt?.toISOString(),
    },
  };
}

export async function disconnectIntegration(
  ownerId: string = '00000000-0000-0000-0000-000000000001',
  provider: string
): Promise<boolean> {
  return credentialsRepo.deleteCredential(ownerId, provider);
}
