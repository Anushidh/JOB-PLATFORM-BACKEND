import mongoose, { Schema } from 'mongoose';
import { IJob, JobType, WorkMode, ExperienceLevel, JobStatus } from '../types';

const JobSchema = new Schema<IJob>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    company: {
      type: Schema.Types.ObjectId,
      ref: 'Company',
      required: true,
    },
    employer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    salaryMin: { type: Number },
    salaryMax: { type: Number },
    salaryCurrency: { type: String, default: 'INR' },
    location: {
      type: String,
      required: true,
    },
    jobType: {
      type: String,
      enum: Object.values(JobType),
      required: true,
    },
    workMode: {
      type: String,
      enum: Object.values(WorkMode),
      required: true,
    },
    experienceLevel: {
      type: String,
      enum: Object.values(ExperienceLevel),
      required: true,
    },
    skillsRequired: [{ type: String }],
    status: {
      type: String,
      enum: Object.values(JobStatus),
      default: JobStatus.PENDING,
    },
    applicationDeadline: { type: Date },
    applicationsCount: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
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

// Indexes for search and filtering
JobSchema.index({ title: 'text', description: 'text' });
JobSchema.index({ status: 1 });
JobSchema.index({ employer: 1 });
JobSchema.index({ company: 1 });
JobSchema.index({ jobType: 1 });
JobSchema.index({ workMode: 1 });
JobSchema.index({ experienceLevel: 1 });
JobSchema.index({ location: 1 });
JobSchema.index({ skillsRequired: 1 });
JobSchema.index({ salaryMin: 1, salaryMax: 1 });

const Job = mongoose.model<IJob>('Job', JobSchema);

export default Job;
