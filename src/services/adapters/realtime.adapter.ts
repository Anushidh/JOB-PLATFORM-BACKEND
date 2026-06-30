import { emitNotification, emitNewMessage, emitToConversation } from '../../socket';

export interface RealtimeAdapter {
  emitNotification(userId: string, notification: unknown): void;
  emitNewMessage(recipientId: string, message: unknown): void;
  emitToConversation(conversationId: string, event: string, data: unknown): void;
}

export class SocketRealtimeAdapter implements RealtimeAdapter {
  emitNotification = emitNotification;
  emitNewMessage = emitNewMessage;
  emitToConversation = emitToConversation;
}
