import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Employee from '../models/Employee';
import Employer from '../models/Employer';
import Admin from '../models/Admin';
import { ApiError } from '../utils/apiError';
import { AuthRequest, TokenPayload, UserRole } from '../types';
import tokenService from '../services/token.service';
import env from '../config/env';

/** Extracts and verifies the JWT from the Authorization header, loads the user, and attaches it to the request */
export const authenticate = async (
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Access token required');
    }

    const token = authHeader.split(' ')[1];

    // Check if token is blacklisted in Redis
    const isBlacklisted = await tokenService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw ApiError.unauthorized('Token has been revoked');
    }

    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;

    // Fetch user from the correct collection based on role
    let user;
    if (decoded.role === UserRole.EMPLOYEE) {
      user = await Employee.findById(decoded.userId);
    } else if (decoded.role === UserRole.EMPLOYER) {
      user = await Employer.findById(decoded.userId);
    } else if (decoded.role === UserRole.ADMIN) {
      user = await Admin.findById(decoded.userId);
    } else {
      throw ApiError.unauthorized('Invalid token role');
    }

    if (!user) {
      throw ApiError.unauthorized('User not found');
    }

    if (decoded.role !== UserRole.ADMIN) {
      if ((user as any).isSuspended) {
        throw ApiError.forbidden('Account is suspended');
      }

      if (!(user as any).isActive) {
        throw ApiError.forbidden('Account is deactivated');
      }
    }

    (req as AuthRequest).user = user as any;
    (req as AuthRequest).userRole = decoded.role;
    (req as AuthRequest).userId = decoded.userId;

    // Update last active timestamp (fire and forget)
    if (decoded.role === UserRole.EMPLOYEE) {
      Employee.findByIdAndUpdate(decoded.userId, { lastActiveAt: new Date() }).exec().catch(() => {});
    } else if (decoded.role === UserRole.EMPLOYER) {
      Employer.findByIdAndUpdate(decoded.userId, { lastActiveAt: new Date() }).exec().catch(() => {});
    }

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      next(error);
    } else if (error instanceof jwt.TokenExpiredError) {
      next(ApiError.unauthorized('Token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(ApiError.unauthorized('Invalid token'));
    } else {
      next(ApiError.unauthorized('Authentication failed'));
    }
  }
};
