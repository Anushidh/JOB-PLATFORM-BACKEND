import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { AuthRequest, UserRole } from '../types';

/** Returns a middleware that restricts access to users with one of the specified roles */
export const roleGuard = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthRequest;

    if (!authReq.user || !authReq.userRole) {
      return next(ApiError.unauthorized('Authentication required'));
    }

    if (!allowedRoles.includes(authReq.userRole)) {
      return next(
        ApiError.forbidden(
          `Access denied. Required role(s): ${allowedRoles.join(', ')}`
        )
      );
    }

    next();
  };
};
