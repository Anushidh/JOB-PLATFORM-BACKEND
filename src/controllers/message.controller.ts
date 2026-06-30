import { Request, Response, NextFunction } from 'express';
import { MessageService } from '../services/message.service';
import { ApiResponse } from '../utils/apiResponse';
import { UserRole } from '../types';
import { DEFAULT_PAGE, DEFAULT_LIMIT } from '../utils/constants';

export class MessageController {
  constructor(private readonly messageService: MessageService) {}
  async sendMessage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { recipientId, recipientRole, content } = req.body;

      const message = await this.messageService.sendMessage({
        senderId: req.userId!,
        senderRole: req.userRole!,
        recipientId,
        recipientRole,
        content,
      });

      ApiResponse.created(res, { message }, 'Message sent successfully');
    } catch (error) {
      next(error);
    }
  }

  async getConversations(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;

      const result = await this.messageService.getConversations(req.userId!, { page, limit });
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async getMessages(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || DEFAULT_PAGE;
      const limit = parseInt(req.query.limit as string) || DEFAULT_LIMIT;

      const result = await this.messageService.getMessages(
        req.params.conversationId,
        req.userId!,
        { page, limit }
      );
      ApiResponse.paginated(res, result.data, result.pagination.total, page, limit);
    } catch (error) {
      next(error);
    }
  }

  async getUnreadCount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const count = await this.messageService.getUnreadCount(req.userId!);
      ApiResponse.success(res, { count }, 'Unread count retrieved');
    } catch (error) {
      next(error);
    }
  }

  async deleteConversation(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.messageService.deleteConversation(req.params.conversationId, req.userId!);
      ApiResponse.success(res, null, 'Conversation deleted');
    } catch (error) {
      next(error);
    }
  }
}

