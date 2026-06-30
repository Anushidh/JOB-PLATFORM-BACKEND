import { Router, Request, Response, NextFunction } from 'express';
import passport from '../config/passport';
import { tokenService } from '../container';
import { UserRole } from '../types';
import env from '../config/env';

const router = Router();

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

router.get('/linkedin', (req: Request, res: Response, next: NextFunction) => {
  const role = req.query.role === UserRole.EMPLOYER ? UserRole.EMPLOYER : UserRole.EMPLOYEE;

  passport.authenticate('linkedin', {
    state: role,
    session: false,
  })(req, res, next);
});

router.get('/linkedin/callback',
  (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('linkedin', {
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
      console.error('[OAuth LinkedIn] Error generating tokens:', error);
      res.redirect(`${env.CORS_ORIGIN}/login?error=oauth_failed`);
    }
  },
);

export default router;
