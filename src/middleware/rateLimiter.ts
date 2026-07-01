import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { RequestHandler } from 'express';
import redis from '../config/redis';
import env from '../config/env';

// In development, skip all rate limiting
const isDev = env.NODE_ENV === 'development';
const noopLimiter: RequestHandler = (_req, _res, next) => next();

/** Rate limiter for all routes: 1000 requests per 15 minutes per IP, backed by Redis */
export const globalLimiter = isDev ? noopLimiter : rateLimit({
  store: new RedisStore({
    // @ts-expect-error - Known compatibility issue with ioredis and rate-limit-redis types
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 min per IP
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Rate limiter for auth routes: 100 attempts per 15 minutes per IP */
export const authLimiter = isDev ? noopLimiter : rateLimit({
  store: new RedisStore({
    // @ts-expect-error - Known compatibility issue
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 attempts per 15 min per IP
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Rate limiter for OTP requests: 50 per hour per IP (generous for dev) */
export const otpLimiter = isDev ? noopLimiter : rateLimit({
  store: new RedisStore({
    // @ts-expect-error - Known compatibility issue
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 50, // 50 OTP requests per hour per IP
  message: {
    success: false,
    message: 'Too many OTP requests, please try again after an hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Rate limiter for sensitive actions (password changes): 5 per 15 minutes per IP */
export const sensitiveLimiter = isDev ? noopLimiter : rateLimit({
  store: new RedisStore({
    // @ts-expect-error - Known compatibility issue
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 min
  message: {
    success: false,
    message: 'Too many attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Rate limiter for job creation: 200 posts per hour per IP */
export const jobCreationLimiter = isDev ? noopLimiter : rateLimit({
  store: new RedisStore({
    // @ts-expect-error - Known compatibility issue
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200, // 200 job posts per hour
  message: {
    success: false,
    message: 'Too many job listings created, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Rate limiter for application submissions: 200 per hour per IP */
export const applicationLimiter = isDev ? noopLimiter : rateLimit({
  store: new RedisStore({
    // @ts-expect-error - Known compatibility issue
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 200, // 200 applications per hour
  message: {
    success: false,
    message: 'Too many applications submitted, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
