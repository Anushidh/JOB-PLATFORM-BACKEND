import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as LinkedInStrategy } from 'passport-linkedin-oauth2';
import crypto from 'crypto';
import Employee from '../models/Employee';
import Employer from '../models/Employer';
import { UserRole } from '../types';
import env from './env';

// Helper to find or create user based on OAuth profile
async function findOrCreateOAuthUser(
  profile: {
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  },
  role: UserRole
) {
  if (role === UserRole.EMPLOYEE) {
    let user = await Employee.findOne({ email: profile.email });
    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString('hex');
      user = await Employee.create({
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatar: profile.avatar,
        password: randomPassword,
      });
    }
    return user;
  } else {
    let user = await Employer.findOne({ email: profile.email });
    if (!user) {
      const randomPassword = crypto.randomBytes(32).toString('hex');
      user = await Employer.create({
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatar: profile.avatar,
        password: randomPassword,
      });
    }
    return user;
  }
}

// Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
      passReqToCallback: true,
    },
    async (req: any, _accessToken: string, _refreshToken: string, profile: any, done: any) => {
      try {
        // Get role from state parameter
        const state = req.query.state;
        let role = UserRole.EMPLOYEE;
        try {
          const parsed = JSON.parse(state);
          role = parsed.role === UserRole.EMPLOYER ? UserRole.EMPLOYER : UserRole.EMPLOYEE;
        } catch {
          role = state === UserRole.EMPLOYER ? UserRole.EMPLOYER : UserRole.EMPLOYEE;
        }

        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email found in Google profile'), null);
        }

        const user = await findOrCreateOAuthUser(
          {
            email,
            firstName: profile.name?.givenName || 'User',
            lastName: profile.name?.familyName || '',
            avatar: profile.photos?.[0]?.value,
          },
          role
        );

        return done(null, { user, role });
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// LinkedIn Strategy
passport.use(
  new LinkedInStrategy(
    {
      clientID: env.LINKEDIN_CLIENT_ID,
      clientSecret: env.LINKEDIN_CLIENT_SECRET,
      callbackURL: env.LINKEDIN_CALLBACK_URL,
      scope: ['openid', 'profile', 'email'],
      passReqToCallback: true,
    } as any,
    async (req: any, _accessToken: string, _refreshToken: string, profile: any, done: any) => {
      try {
        // Get role from state parameter
        const state = req.query.state;
        let role = UserRole.EMPLOYEE;
        try {
          const parsed = JSON.parse(state);
          role = parsed.role === UserRole.EMPLOYER ? UserRole.EMPLOYER : UserRole.EMPLOYEE;
        } catch {
          role = state === UserRole.EMPLOYER ? UserRole.EMPLOYER : UserRole.EMPLOYEE;
        }

        const email = profile.emails?.[0]?.value;
        if (!email) {
          return done(new Error('No email found in LinkedIn profile'), null);
        }

        const user = await findOrCreateOAuthUser(
          {
            email,
            firstName: profile.name?.givenName || profile.displayName?.split(' ')[0] || 'User',
            lastName: profile.name?.familyName || profile.displayName?.split(' ').slice(1).join(' ') || '',
            avatar: profile.photos?.[0]?.value,
          },
          role
        );

        return done(null, { user, role });
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// Serialize and deserialize (not used for JWT-based auth, but required by passport)
passport.serializeUser((user: any, done) => {
  done(null, user);
});

passport.deserializeUser((obj: any, done) => {
  done(null, obj);
});

export default passport;
