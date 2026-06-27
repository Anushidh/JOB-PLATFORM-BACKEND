import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/apiError';
import { ApiResponse } from '../utils/apiResponse';
import env from '../config/env';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): Response => {
  if (err instanceof ApiError) {
    return ApiResponse.error(res, err.statusCode, err.message, err.errors);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    return ApiResponse.error(res, 400, 'Validation Error', [err.message]);
  }

  // Mongoose duplicate key error
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyValue || {})[0];
    return ApiResponse.error(res, 409, `${field || 'Field'} already exists`);
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    return ApiResponse.error(res, 400, 'Invalid ID format');
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return ApiResponse.error(res, 401, 'Invalid token');
  }

  if (err.name === 'TokenExpiredError') {
    return ApiResponse.error(res, 401, 'Token expired');
  }

  // Default error
  console.error('Unhandled Error:', err);
  const message = env.NODE_ENV === 'development' ? err.message : 'Internal server error';
  return ApiResponse.error(res, 500, message);
};

export const notFoundHandler = (req: Request, res: Response): Response => {
  return ApiResponse.error(res, 404, `Route ${req.originalUrl} not found`);
};
