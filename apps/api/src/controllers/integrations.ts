import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import * as integrationService from '../services/integrations.js';

export const saveTokenSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  ownerId: z.string().uuid().optional(),
});

function getOwnerId(req: Request): string {
  const queryOwnerId = req.query.ownerId as string | undefined;
  const bodyOwnerId = req.body?.ownerId as string | undefined;
  const headerOwnerId = req.headers['x-owner-id'] as string | undefined;
  return (
    req.user?.id ||
    queryOwnerId ||
    bodyOwnerId ||
    headerOwnerId ||
    '00000000-0000-0000-0000-000000000001'
  );
}

export async function slackAuthorizeHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = getOwnerId(req);
    const redirectUri = req.query.redirect_uri as string | undefined;
    const authInfo = await integrationService.getSlackAuthorizeUrl(ownerId, redirectUri);

    if (req.query.json === 'true' || req.headers.accept?.includes('application/json')) {
      res.json(authInfo);
      return;
    }

    if (!authInfo.configured) {
      res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Slack OAuth Configuration Missing</title></head>
        <body style="font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; text-align: center;">
          <h2 style="color: #f87171;">Slack OAuth App Not Configured</h2>
          <p style="color: #94a3b8; max-width: 500px; margin: 0 auto 20px;">
            To use OAuth, please set <code>SLACK_CLIENT_ID</code> and <code>SLACK_CLIENT_SECRET</code> in your <code>.env</code> file.
          </p>
          <p style="color: #cbd5e1;">Alternatively, you can paste a <b>Bot User OAuth Token (xoxb-...)</b> directly in the Node Configuration Modal without setting up an OAuth app.</p>
          <button onclick="window.close()" style="margin-top: 20px; padding: 8px 16px; background: #334155; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Close Window</button>
        </body>
        </html>
      `);
      return;
    }

    res.redirect(authInfo.url);
  } catch (err) {
    next(err);
  }
}

export async function slackCallbackHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const code = req.query.code as string;
    const state = req.query.state as string | undefined;

    let ownerId = '00000000-0000-0000-0000-000000000001';

    if (state) {
      try {
        const decoded = JSON.parse(Buffer.from(state, 'base64').toString('utf-8'));
        if (decoded.ownerId) ownerId = decoded.ownerId;
      } catch {
        // Use defaults
      }
    }

    const payload = await integrationService.exchangeSlackCode(code, ownerId);

    if (req.headers.accept?.includes('application/json')) {
      res.json({
        success: true,
        provider: 'slack',
        teamName: payload.teamName,
      });
      return;
    }

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Slack Connected</title></head>
      <body style="font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; text-align: center;">
        <h2 style="color: #10b981;">Slack Connected Successfully!</h2>
        <p style="color: #94a3b8;">Workspace: <b>${payload.teamName || 'Slack'}</b></p>
        <p style="color: #64748b; font-size: 13px;">This window will close automatically...</p>
        <script>
          if (window.opener) {
            window.opener.postMessage({ type: 'SLACK_AUTH_SUCCESS', provider: 'slack' }, '*');
            setTimeout(() => window.close(), 1000);
          } else {
            window.location.href = '/?connected=slack';
          }
        </script>
      </body>
      </html>
    `);
  } catch (err: any) {
    res.status(400).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Slack Authorization Error</title></head>
      <body style="font-family: system-ui, sans-serif; background: #0f172a; color: #f8fafc; padding: 40px; text-align: center;">
        <h2 style="color: #f87171;">Authorization Failed</h2>
        <p style="color: #94a3b8;">${err.message || 'Unknown error'}</p>
        <button onclick="window.close()" style="margin-top: 20px; padding: 8px 16px; background: #334155; color: #fff; border: none; border-radius: 6px; cursor: pointer;">Close Window</button>
      </body>
      </html>
    `);
  }
}

export async function getSlackChannelsHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = getOwnerId(req);
    const channels = await integrationService.getSlackChannels(ownerId);
    res.json(channels);
  } catch (err) {
    next(err);
  }
}

export async function saveSlackTokenHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = getOwnerId(req);
    await integrationService.saveDirectSlackToken(ownerId, req.body.token);
    res.status(200).json({
      success: true,
      message: 'Slack token saved successfully',
    });
  } catch (err) {
    next(err);
  }
}

export async function getIntegrationStatusHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = getOwnerId(req);
    const status = await integrationService.getIntegrationStatus(ownerId);
    res.json(status);
  } catch (err) {
    next(err);
  }
}

function getParam(req: Request, key: string): string {
  const val = req.params[key];
  return Array.isArray(val) ? val[0] : (val as string);
}

export async function disconnectIntegrationHandler(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const ownerId = getOwnerId(req);
    const provider = getParam(req, 'provider');
    const deleted = await integrationService.disconnectIntegration(ownerId, provider);
    res.json({ success: deleted, provider });
  } catch (err) {
    next(err);
  }
}
