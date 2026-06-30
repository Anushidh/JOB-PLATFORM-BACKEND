import Conversation, { IConversation } from '../models/Conversation';
import Message, { IMessage } from '../models/Message';
import { PaginationOptions, PaginatedResult } from '../types';

export class MessageRepository {
  constructor(
    private readonly conversationModel: typeof Conversation = Conversation,
    private readonly messageModel: typeof Message = Message,
  ) {}

  findConversation(user1Id: string, user2Id: string) {
    return this.conversationModel.findOne({
      $and: [
        { 'participants.userId': user1Id },
        { 'participants.userId': user2Id },
      ],
    });
  }

  createConversation(participants: { userId: string; role: string }[]) {
    return this.conversationModel.create({ participants });
  }

  createMessage(data: Record<string, unknown>) {
    return this.messageModel.create(data);
  }

  async findConversationsByUser(
    userId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<IConversation>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const query = { 'participants.userId': userId };

    const [conversations, total] = await Promise.all([
      this.conversationModel.find(query)
        .populate('lastMessage', 'content createdAt sender isRead')
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit),
      this.conversationModel.countDocuments(query),
    ]);

    return {
      data: conversations,
      pagination: {
        total, page, limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  findConversationById(conversationId: string) {
    return this.conversationModel.findById(conversationId);
  }

  async findMessages(
    conversationId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<IMessage>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const query = { conversation: conversationId };

    const [messages, total] = await Promise.all([
      this.messageModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.messageModel.countDocuments(query),
    ]);

    return {
      data: messages,
      pagination: {
        total, page, limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  markMessagesAsRead(conversationId: string, userId: string) {
    return this.messageModel.updateMany(
      {
        conversation: conversationId,
        'sender.userId': { $ne: userId },
        isRead: false,
      },
      { isRead: true, readAt: new Date() },
    );
  }

  findConversationIdsByUser(userId: string) {
    return this.conversationModel.find({ 'participants.userId': userId }).select('_id');
  }

  countUnreadMessages(conversationIds: unknown[], userId: string) {
    return this.messageModel.countDocuments({
      conversation: { $in: conversationIds },
      'sender.userId': { $ne: userId },
      isRead: false,
    });
  }

  deleteMessagesByConversation(conversationId: string) {
    return this.messageModel.deleteMany({ conversation: conversationId });
  }

  deleteConversation(conversationId: string) {
    return this.conversationModel.findByIdAndDelete(conversationId);
  }
}
