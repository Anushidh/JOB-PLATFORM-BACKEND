import mongoose, { Schema, Document, Types } from 'mongoose';
import { UserRole } from '../types';

export interface IMessage extends Document {
  _id: Types.ObjectId;
  conversation: Types.ObjectId;
  sender: {
    userId: Types.ObjectId;
    role: UserRole;
  };
  content: string;
  isRead: boolean;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    conversation: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    sender: {
      userId: { type: Schema.Types.ObjectId, required: true },
      role: { type: String, enum: Object.values(UserRole), required: true },
    },
    content: {
      type: String,
      required: true,
      maxlength: 5000,
    },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

MessageSchema.index({ conversation: 1, createdAt: -1 });
MessageSchema.index({ 'sender.userId': 1 });

const Message = mongoose.model<IMessage>('Message', MessageSchema);

export default Message;
