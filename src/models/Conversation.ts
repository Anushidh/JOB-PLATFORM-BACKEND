import mongoose, { Schema, Document, Types } from 'mongoose';
import { UserRole } from '../types';

export interface IConversation extends Document {
  _id: Types.ObjectId;
  participants: {
    userId: Types.ObjectId;
    role: UserRole;
  }[];
  lastMessage?: Types.ObjectId;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ParticipantSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    role: { type: String, enum: Object.values(UserRole), required: true },
  },
  { _id: false }
);

const ConversationSchema = new Schema<IConversation>(
  {
    participants: {
      type: [ParticipantSchema],
      validate: {
        validator: (v: any[]) => v.length === 2,
        message: 'Conversation must have exactly 2 participants',
      },
    },
    lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
    lastMessageAt: { type: Date },
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

// Index for finding conversations by participant
ConversationSchema.index({ 'participants.userId': 1 });
ConversationSchema.index({ lastMessageAt: -1 });

const Conversation = mongoose.model<IConversation>('Conversation', ConversationSchema);

export default Conversation;
