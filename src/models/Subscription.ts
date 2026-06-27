import mongoose, { Schema, Document, Types } from 'mongoose';

export enum PlanType {
  FREE = 'free',
  BASIC = 'basic',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  PENDING = 'pending',
}

export interface ISubscription extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  userRole: string;
  plan: PlanType;
  status: SubscriptionStatus;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySubscriptionId?: string;
  amount: number;
  currency: string;
  startDate: Date;
  endDate: Date;
  features: {
    maxJobPosts?: number;
    maxApplications?: number;
    premiumPlacement: boolean;
    resumeAccess: boolean;
    analyticsAccess: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const FeaturesSchema = new Schema({
  maxJobPosts: { type: Number },
  maxApplications: { type: Number },
  premiumPlacement: { type: Boolean, default: false },
  resumeAccess: { type: Boolean, default: false },
  analyticsAccess: { type: Boolean, default: false },
}, { _id: false });

const SubscriptionSchema = new Schema<ISubscription>({
  user: { type: Schema.Types.ObjectId, required: true },
  userRole: { type: String, required: true, enum: ['employee', 'employer'] },
  plan: { type: String, enum: Object.values(PlanType), required: true },
  status: { type: String, enum: Object.values(SubscriptionStatus), default: SubscriptionStatus.PENDING },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  razorpaySubscriptionId: { type: String },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  startDate: { type: Date },
  endDate: { type: Date },
  features: { type: FeaturesSchema, required: true },
}, { timestamps: true });

SubscriptionSchema.index({ user: 1, status: 1 });
SubscriptionSchema.index({ razorpayOrderId: 1 });
SubscriptionSchema.index({ razorpayPaymentId: 1 });
SubscriptionSchema.index({ status: 1, endDate: 1 });

const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
export default Subscription;
