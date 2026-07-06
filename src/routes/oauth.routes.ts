import { Router, Request, Response, NextFunction } from 'express';
import axios from 'axios';
import passport from '../config/passport';
import { tokenService } from '../container';
import { UserRole } from '../types';
import env from '../config/env';
import Employee from '../models/Employee';
import Employer from '../models/Employer';
import crypto from 'crypto';

const router = Router();

// ─── Google OAuth ─────────────────────────────────────────────────────────────

router.get('/google', (req: Request, res: Response, next: NextFunction) => {
  const role = req.query.role === UserRole.EMPLOYER ? UserRole.EMPLOYER : UserRole.EMPLOYEE;

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: role,
    session: false,
  })(req, res, next);
});

router.get('/google/callback',
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('google', {
      session: false,
      failureRedirect: `${env.CORS_ORIGIN}/login?error=oauth_failed`,
    })(req, res, next);
  },
  async (req: Request, res: Response) => {
    try {
      const { user, role } = req.user as { user: { _id: { toString(): string } }; role: string };

      const tokens = await tokenService.generateTokenPair(
        user._id.toString(),
        role as UserRole,
      );

      const redirectUrl = `${env.CORS_ORIGIN}/oauth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}&role=${role}`;
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('[OAuth Google] Error generating tokens:', error);
      res.redirect(`${env.CORS_ORIGIN}/login?error=oauth_failed`);
    }
  },
);

// ─── LinkedIn OAuth (OpenID Connect) ─────────────────────────────────────────

router.get('/linkedin', (req: Request, res: Response) => {
  const role = req.query.role === UserRole.EMPLOYER ? UserRole.EMPLOYER : UserRole.EMPLOYEE;

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: env.LINKEDIN_CLIENT_ID,
    redirect_uri: env.LINKEDIN_CALLBACK_URL,
    scope: 'openid profile email',
    state: role,
  });

  res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`);
});

router.get('/linkedin/callback', async (req: Request, res: Response) => {
  const { code, state, error } = req.query;

  if (error || !code) {
    console.error('[OAuth LinkedIn] Error from LinkedIn:', error);
    return res.redirect(`${env.CORS_ORIGIN}/login?error=oauth_failed`);
  }

  const role = state === UserRole.EMPLOYER ? UserRole.EMPLOYER : UserRole.EMPLOYEE;

  try {
    // Exchange code for tokens
    const tokenResponse = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: env.LINKEDIN_CALLBACK_URL,
        client_id: env.LINKEDIN_CLIENT_ID,
        client_secret: env.LINKEDIN_CLIENT_SECRET,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenResponse.data.access_token;

    // Fetch user info via OpenID Connect userinfo endpoint
    const userInfoResponse = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const profile = userInfoResponse.data;
    const email = profile.email;
    const firstName = profile.given_name || profile.name?.split(' ')[0] || 'User';
    const lastName = profile.family_name || profile.name?.split(' ').slice(1).join(' ') || '';
    const avatar = profile.picture;

    if (!email) {
      return res.redirect(`${env.CORS_ORIGIN}/login?error=oauth_failed`);
    }

    // Find or create user
    let user;
    if (role === UserRole.EMPLOYEE) {
      user = await Employee.findOne({ email });
      if (!user) {
        user = await Employee.create({
          email,
          firstName,
          lastName,
          avatar,
          password: crypto.randomBytes(32).toString('hex'),
        });
      }
    } else {
      user = await Employer.findOne({ email });
      if (!user) {
        user = await Employer.create({
          email,
          firstName,
          lastName,
          avatar,
          password: crypto.randomBytes(32).toString('hex'),
        });
      }
    }

    const tokens = await tokenService.generateTokenPair(
      user._id.toString(),
      role as UserRole,
    );

    const redirectUrl = `${env.CORS_ORIGIN}/oauth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}&role=${role}`;
    return res.redirect(redirectUrl);
  } catch (err: any) {
    console.error('[OAuth LinkedIn] Error:', err?.response?.data || err.message);
    return res.redirect(`${env.CORS_ORIGIN}/login?error=oauth_failed`);
  }
});

export default router;
