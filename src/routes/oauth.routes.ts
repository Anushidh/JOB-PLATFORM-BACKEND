import { Router, Request, Response, NextFunction } from 'express';
import passport from '../config/passport';
import tokenService from '../services/token.service';
import { UserRole } from '../types';
import env from '../config/env';

const router = Router();

// Google OAuth - Initiate
router.get('/google', (req: Request, res: Response, next: NextFunction) => {
  const role = req.query.role === UserRole.EMPLOYER ? UserRole.EMPLOYER : UserRole.EMPLOYEE;

  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state: role,
    session: false,
  })(req, res, next);
});

// Google OAuth - Callback
router.get('/google/callback',
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('google', {
      session: false,
      failureRedirect: `${env.CORS_ORIGIN}/login?error=oauth_failed`,
    })(req, res, next);
  },
  async (req: Request, res: Response) => {
    try {
      const { user, role } = req.user as any;

      // Generate token pair
      const tokens = await tokenService.generateTokenPair(
        user._id.toString(),
        role as UserRole
      );

      // Redirect to frontend with tokens
      const redirectUrl = `${env.CORS_ORIGIN}/oauth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}&role=${role}`;
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('[OAuth Google] Error generating tokens:', error);
      res.redirect(`${env.CORS_ORIGIN}/login?error=oauth_failed`);
    }
  }
);

// LinkedIn OAuth - Initiate
router.get('/linkedin', (req: Request, res: Response, next: NextFunction) => {
  const role = req.query.role === UserRole.EMPLOYER ? UserRole.EMPLOYER : UserRole.EMPLOYEE;

  passport.authenticate('linkedin', {
    state: role,
    session: false,
  })(req, res, next);
});

// LinkedIn OAuth - Callback
router.get('/linkedin/callback',
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('linkedin', {
      session: false,
      failureRedirect: `${env.CORS_ORIGIN}/login?error=oauth_failed`,
    })(req, res, next);
  },
  async (req: Request, res: Response) => {
    try {
      const { user, role } = req.user as any;

      // Generate token pair
      const tokens = await tokenService.generateTokenPair(
        user._id.toString(),
        role as UserRole
      );

      // Redirect to frontend with tokens
      const redirectUrl = `${env.CORS_ORIGIN}/oauth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}&role=${role}`;
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('[OAuth LinkedIn] Error generating tokens:', error);
      res.redirect(`${env.CORS_ORIGIN}/login?error=oauth_failed`);
    }
  }
);

export default router;
