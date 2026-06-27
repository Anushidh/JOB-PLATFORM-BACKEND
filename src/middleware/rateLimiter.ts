import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import redis from '../config/redis';

/** Rate limiter for all routes: 100 requests per 15 minutes per IP, backed by Redis */
export const globalLimiter = rateLimit({
  store: new RedisStore({
    // @ts-expect-error - Known compatibility issue with ioredis and rate-limit-redis types
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 min per IP
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Rate limiter for auth routes: 10 attempts per 15 minutes per IP */
export const authLimiter = rateLimit({
  store: new RedisStore({
    // @ts-expect-error - Known compatibility issue
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 min per IP
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Rate limiter for OTP requests: 5 per hour per IP */
export const otpLimiter = rateLimit({
  store: new RedisStore({
    // @ts-expect-error - Known compatibility issue
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 OTP requests per hour per IP
  message: {
    success: false,
    message: 'Too many OTP requests, please try again after an hour.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Rate limiter for sensitive actions (password changes): 5 per 15 minutes per IP */
export const sensitiveLimiter = rateLimit({
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

/** Rate limiter for job creation: 20 posts per hour per IP */
export const jobCreationLimiter = rateLimit({
  store: new RedisStore({
    // @ts-expect-error - Known compatibility issue
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 job posts per hour
  message: {
    success: false,
    message: 'Too many job listings created, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/** Rate limiter for application submissions: 30 per hour per IP */
export const applicationLimiter = rateLimit({
  store: new RedisStore({
    // @ts-expect-error - Known compatibility issue
    sendCommand: (...args: string[]) => redis.call(...args),
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30, // 30 applications per hour
  message: {
    success: false,
    message: 'Too many applications submitted, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
