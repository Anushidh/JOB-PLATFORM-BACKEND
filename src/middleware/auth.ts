import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from '../utils/apiError';
import { TokenPayload, UserRole } from '../types';
import { TokenService } from '../services/token.service';
import { AuthRepository } from '../repositories/auth.repository';
import env from '../config/env';

export const createAuthenticateMiddleware = (
  tokenService: TokenService,
  authRepository: AuthRepository,
) => {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw ApiError.unauthorized('Access token required');
      }

      const token = authHeader.split(' ')[1];

      const isBlacklisted = await tokenService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw ApiError.unauthorized('Token has been revoked');
      }

      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;

      const user = await authRepository.findUserById(decoded.userId, decoded.role);

      if (!user) {
        throw ApiError.unauthorized('User not found');
      }

      if (decoded.role !== UserRole.ADMIN) {
        if ((user as { isSuspended?: boolean }).isSuspended) {
          throw ApiError.forbidden('Account is suspended');
        }

        if (!(user as { isActive?: boolean }).isActive) {
          throw ApiError.forbidden('Account is deactivated');
        }
      }

      req.user = user as Express.Request['user'];
      req.userRole = decoded.role;
      req.userId = decoded.userId;

      authRepository.updateLastActive(decoded.userId, decoded.role);

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
};
