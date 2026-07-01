import { Request, Response, NextFunction } from 'express';
import { BroadcastService } from '../services/broadcast.service';
import { ApiResponse } from '../utils/apiResponse';
import { ApiError } from '../utils/apiError';

export class BroadcastController {
  constructor(private readonly broadcastService: BroadcastService) {}

  async sendBroadcast(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { title, message, target } = req.body;

      if (!title || !message) {
        throw ApiError.badRequest('Title and message are required');
      }

      if (!['all', 'employees', 'employers'].includes(target)) {
        throw ApiError.badRequest('Target must be all, employees, or employers');
      }

      const result = await this.broadcastService.sendBroadcast({ title, message, target });

      ApiResponse.success(res, result, `Broadcast sent to ${result.recipientCount} users`);
    } catch (error) {
      next(error);
    }
  }
}
