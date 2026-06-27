import { Response } from 'express';
import { ApiResponseData } from '../types';

export class ApiResponse {
  static success<T>(res: Response, data?: T, message = 'Success', statusCode = 200): Response {
    const response: ApiResponseData<T> = {
      success: true,
      message,
      data,
    };
    return res.status(statusCode).json(response);
  }

  static created<T>(res: Response, data?: T, message = 'Created successfully'): Response {
    return ApiResponse.success(res, data, message, 201);
  }

  static noContent(res: Response): Response {
    return res.status(204).send();
  }

  static error(res: Response, statusCode: number, message: string, errors: any[] = []): Response {
    const response: ApiResponseData = {
      success: false,
      message,
      errors: errors.length > 0 ? errors : undefined,
    };
    return res.status(statusCode).json(response);
  }

  static paginated<T>(
    res: Response,
    data: T[],
    total: number,
    page: number,
    limit: number,
    message = 'Success'
  ): Response {
    const pages = Math.ceil(total / limit);
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        total,
        page,
        limit,
        pages,
        hasNext: page < pages,
        hasPrev: page > 1,
      },
    });
  }
}
