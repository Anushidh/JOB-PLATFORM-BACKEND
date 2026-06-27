import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IJobAlert extends Document {
  _id: Types.ObjectId;
  employee: Types.ObjectId;
  name: string;
  filters: {
    keywords?: string[];
    location?: string;
    jobType?: string[];
    workMode?: string[];
    experienceLevel?: string[];
    salaryMin?: number;
    skills?: string[];
  };
  frequency: 'daily' | 'weekly' | 'instant';
  isActive: boolean;
  lastSentAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const FiltersSchema = new Schema({
  keywords: [{ type: String }],
  location: { type: String },
  jobType: [{ type: String }],
  workMode: [{ type: String }],
  experienceLevel: [{ type: String }],
  salaryMin: { type: Number },
  skills: [{ type: String }],
}, { _id: false });

const JobAlertSchema = new Schema<IJobAlert>({
  employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  name: { type: String, required: true, trim: true },
  filters: { type: FiltersSchema, required: true },
  frequency: { type: String, enum: ['daily', 'weekly', 'instant'], default: 'daily' },
  isActive: { type: Boolean, default: true },
  lastSentAt: { type: Date },
}, { timestamps: true });

JobAlertSchema.index({ employee: 1 });
JobAlertSchema.index({ isActive: 1, frequency: 1 });

const JobAlert = mongoose.model<IJobAlert>('JobAlert', JobAlertSchema);
export default JobAlert;
