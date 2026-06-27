import Conversation, { IConversation } from '../models/Conversation';
import Message, { IMessage } from '../models/Message';
import Employee from '../models/Employee';
import Employer from '../models/Employer';
import { ApiError } from '../utils/apiError';
import { UserRole, PaginationOptions, PaginatedResult } from '../types';
import { emitNewMessage, emitToConversation } from '../socket';

interface SendMessageData {
  senderId: string;
  senderRole: UserRole;
  recipientId: string;
  recipientRole: UserRole;
  content: string;
}

class MessageService {
  /** Finds or creates a conversation between two users */
  private async getOrCreateConversation(
    user1Id: string,
    user1Role: UserRole,
    user2Id: string,
    user2Role: UserRole
  ): Promise<IConversation> {
    // Find existing conversation
    const existing = await Conversation.findOne({
      $and: [
        { 'participants.userId': user1Id },
        { 'participants.userId': user2Id },
      ],
    });

    if (existing) return existing;

    // Create new conversation
    const conversation = await Conversation.create({
      participants: [
        { userId: user1Id, role: user1Role },
        { userId: user2Id, role: user2Role },
      ],
    });

    return conversation;
  }

  /** Sends a message to a recipient, creating or reusing an existing conversation */
  async sendMessage(data: SendMessageData): Promise<IMessage> {
    // Validate recipient exists
    let recipientExists = false;
    if (data.recipientRole === UserRole.EMPLOYEE) {
      recipientExists = !!(await Employee.findById(data.recipientId));
    } else if (data.recipientRole === UserRole.EMPLOYER) {
      recipientExists = !!(await Employer.findById(data.recipientId));
    }

    if (!recipientExists) {
      throw ApiError.notFound('Recipient not found');
    }

    // Prevent messaging yourself
    if (data.senderId === data.recipientId) {
      throw ApiError.badRequest('Cannot send a message to yourself');
    }

    const conversation = await this.getOrCreateConversation(
      data.senderId,
      data.senderRole,
      data.recipientId,
      data.recipientRole
    );

    const message = await Message.create({
      conversation: conversation._id,
      sender: { userId: data.senderId, role: data.senderRole },
      content: data.content,
    });

    // Update conversation's last message
    conversation.lastMessage = message._id;
    conversation.lastMessageAt = message.createdAt;
    await conversation.save();

    // Emit real-time events via Socket.IO
    const messagePayload = {
      _id: message._id,
      conversation: conversation._id,
      sender: message.sender,
      content: message.content,
      isRead: message.isRead,
      createdAt: message.createdAt,
    };

    // Send to recipient's personal room (they see it even if not in the conversation view)
    emitNewMessage(data.recipientId, messagePayload);

    // Send to conversation room (for users actively viewing this conversation)
    emitToConversation(conversation._id.toString(), 'message:new', messagePayload);

    return message;
  }

  /** Returns paginated conversations for a user with participant names populated */
  async getConversations(
    userId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<IConversation>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const query = { 'participants.userId': userId };

    const [conversations, total] = await Promise.all([
      Conversation.find(query)
        .populate('lastMessage', 'content createdAt sender isRead')
        .sort({ lastMessageAt: -1 })
        .skip(skip)
        .limit(limit),
      Conversation.countDocuments(query),
    ]);

    // Populate participant names
    const populatedConversations = await Promise.all(
      conversations.map(async (conv) => {
        const convObj = conv.toJSON();
        const populatedParticipants = await Promise.all(
          conv.participants.map(async (p) => {
            const pObj = { userId: p.userId, role: p.role };
            if (p.role === UserRole.EMPLOYEE) {
              const emp = await Employee.findById(p.userId).select('firstName lastName avatar');
              const name = emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown';
              return { ...pObj, name, avatar: emp?.avatar };
            } else {
              const emp = await Employer.findById(p.userId).select('firstName lastName avatar');
              const name = emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown';
              return { ...pObj, name, avatar: emp?.avatar };
            }
          })
        );
        return { ...convObj, participants: populatedParticipants };
      })
    );

    return {
      data: populatedConversations as any,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /** Returns paginated messages in a conversation and marks unread messages from the other user as read */
  async getMessages(
    conversationId: string,
    userId: string,
    options: PaginationOptions
  ): Promise<PaginatedResult<IMessage>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    // Verify user is a participant
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    const isParticipant = conversation.participants.some(
      (p) => p.userId.toString() === userId
    );
    if (!isParticipant) {
      throw ApiError.forbidden('You are not a participant of this conversation');
    }

    const query = { conversation: conversationId };

    const [messages, total] = await Promise.all([
      Message.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Message.countDocuments(query),
    ]);

    // Mark unread messages from the other user as read
    await Message.updateMany(
      {
        conversation: conversationId,
        'sender.userId': { $ne: userId },
        isRead: false,
      },
      { isRead: true, readAt: new Date() }
    );

    return {
      data: messages,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1,
      },
    };
  }

  /** Returns total unread message count across all conversations for a user */
  async getUnreadCount(userId: string): Promise<number> {
    // Find all conversations this user is part of
    const conversations = await Conversation.find({ 'participants.userId': userId }).select('_id');
    const conversationIds = conversations.map((c) => c._id);

    return Message.countDocuments({
      conversation: { $in: conversationIds },
      'sender.userId': { $ne: userId },
      isRead: false,
    });
  }

  /** Deletes a conversation and all its messages after verifying the user is a participant */
  async deleteConversation(conversationId: string, userId: string): Promise<void> {
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      throw ApiError.notFound('Conversation not found');
    }

    const isParticipant = conversation.participants.some(
      (p) => p.userId.toString() === userId
    );
    if (!isParticipant) {
      throw ApiError.forbidden('You are not a participant of this conversation');
    }

    await Message.deleteMany({ conversation: conversationId });
    await Conversation.findByIdAndDelete(conversationId);
  }
}

export default new MessageService();
