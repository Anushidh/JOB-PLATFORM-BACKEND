import { ApiError } from '../utils/apiError';
import { MessageRepository } from '../repositories/message.repository';
import { UserRepository } from '../repositories/user.repository';
import { RealtimeAdapter } from './adapters/realtime.adapter';
import { IConversation } from '../models/Conversation';
import { IMessage } from '../models/Message';
import { UserRole, PaginationOptions, PaginatedResult } from '../types';

interface SendMessageData {
  senderId: string;
  senderRole: UserRole;
  recipientId: string;
  recipientRole: UserRole;
  content: string;
}

export class MessageService {
  constructor(
    private readonly messageRepository: MessageRepository,
    private readonly userRepository: UserRepository,
    private readonly realtimeAdapter: RealtimeAdapter,
  ) {}

  private async getOrCreateConversation(
    user1Id: string,
    user1Role: UserRole,
    user2Id: string,
    user2Role: UserRole,
  ): Promise<IConversation> {
    const existing = await this.messageRepository.findConversation(user1Id, user2Id);

    if (existing) return existing;

    return this.messageRepository.createConversation([
      { userId: user1Id, role: user1Role },
      { userId: user2Id, role: user2Role },
    ]);
  }

  async sendMessage(data: SendMessageData): Promise<IMessage> {
    let recipientExists = false;
    if (data.recipientRole === UserRole.EMPLOYEE) {
      recipientExists = !!(await this.userRepository.findEmployeeById(data.recipientId));
    } else if (data.recipientRole === UserRole.EMPLOYER) {
      recipientExists = !!(await this.userRepository.findEmployerById(data.recipientId));
    }

    if (!recipientExists) {
      throw ApiError.notFound('Recipient not found');
    }

    if (data.senderId === data.recipientId) {
      throw ApiError.badRequest('Cannot send a message to yourself');
    }

    const conversation = await this.getOrCreateConversation(
      data.senderId,
      data.senderRole,
      data.recipientId,
      data.recipientRole,
    );

    // If either user had "deleted" this conversation, restore it for them
    if ((conversation as any).deletedBy?.length > 0) {
      (conversation as any).deletedBy = [];
      await conversation.save();
    }

    const message = await this.messageRepository.createMessage({
      conversation: conversation._id,
      sender: { userId: data.senderId, role: data.senderRole },
      content: data.content,
    });

    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.createdAt;
    await conversation.save();

    const messagePayload = {
      _id: message._id,
      conversation: conversation._id,
      sender: message.sender,
      content: message.content,
      isRead: message.isRead,
      createdAt: message.createdAt,
    };

    this.realtimeAdapter.emitNewMessage(data.recipientId, messagePayload);
    this.realtimeAdapter.emitToConversation(conversation._id.toString(), 'message:new', messagePayload);

    return message;
  }

  async getConversations(
    userId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<IConversation>> {
    const result = await this.messageRepository.findConversationsByUser(userId, options);

    const populatedConversations = await Promise.all(
      result.data.map(async (conv) => {
        const convObj = conv.toJSON();
        const populatedParticipants = await Promise.all(
          conv.participants.map(async (p) => {
            const pObj = { userId: p.userId, role: p.role };
            if (p.role === UserRole.EMPLOYEE) {
              const emp = await this.userRepository.findEmployeeByIdSelect(p.userId.toString(), 'firstName lastName avatar');
              const name = emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown';
              return { ...pObj, name, avatar: emp?.avatar };
            }
            const emp = await this.userRepository.findEmployerByIdSelect(p.userId.toString(), 'firstName lastName avatar');
            const name = emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown';
            return { ...pObj, name, avatar: emp?.avatar };
          }),
        );
        return { ...convObj, participants: populatedParticipants };
      }),
    );

    return {
      data: populatedConversations as unknown as IConversation[],
      pagination: result.pagination,
    };
  }

  async getMessages(
    conversationId: string,
    userId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<IMessage>> {
    const conversation = await this.messageRepository.findConversationById(conversationId);
    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    const isParticipant = conversation.participants.some(
      (p) => p.userId.toString() === userId,
    );
    if (!isParticipant) {
      throw ApiError.forbidden('You are not a participant of this conversation');
    }

    await this.messageRepository.markMessagesAsRead(conversationId, userId);

    return this.messageRepository.findMessages(conversationId, options);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const conversations = await this.messageRepository.findConversationIdsByUser(userId);
    const conversationIds = conversations.map((c) => c._id);

    return this.messageRepository.countUnreadMessages(conversationIds, userId);
  }

  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.messageRepository.findConversationById(conversationId);
    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    const isParticipant = conversation.participants.some(
      (p) => p.userId.toString() === userId,
    );
    if (!isParticipant) {
      throw ApiError.forbidden('You are not a participant of this conversation');
    }

    // Soft delete — mark as deleted for this user only
    await this.messageRepository.markConversationDeletedForUser(conversationId, userId);
  }
}
