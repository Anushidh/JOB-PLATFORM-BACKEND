import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IJobAnalytics extends Document {
  _id: Types.ObjectId;
  job: Types.ObjectId;
  views: number;
  uniqueViews: number;
  clicks: number;
  applications: number;
  viewedBy: Types.ObjectId[];
  dailyStats: {
    date: Date;
    views: number;
    clicks: number;
    applications: number;
  }[];
  createdAt: Date;
  updatedAt: Date;
}

const DailyStatSchema = new Schema({
  date: { type: Date, required: true },
  views: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  applications: { type: Number, default: 0 },
}, { _id: false });

const JobAnalyticsSchema = new Schema<IJobAnalytics>({
  job: { type: Schema.Types.ObjectId, ref: 'Job', required: true, unique: true },
  views: { type: Number, default: 0 },
  uniqueViews: { type: Number, default: 0 },
  clicks: { type: Number, default: 0 },
  applications: { type: Number, default: 0 },
  viewedBy: [{ type: Schema.Types.ObjectId }],
  dailyStats: [DailyStatSchema],
}, { timestamps: true });

const JobAnalytics = mongoose.model<IJobAnalytics>('JobAnalytics', JobAnalyticsSchema);
export default JobAnalytics;
