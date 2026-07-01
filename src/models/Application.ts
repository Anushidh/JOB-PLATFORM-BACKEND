import mongoose, { Schema } from 'mongoose';
import { IApplication, ApplicationStatus } from '../types';

const StatusHistorySchema = new Schema(
  {
    status: {
      type: String,
      enum: Object.values(ApplicationStatus),
      required: true,
    },
    changedAt: { type: Date, default: Date.now },
    note: { type: String },
  },
  { _id: false }
);

const ApplicationSchema = new Schema<IApplication>(
  {
    job: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
    applicant: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    coverLetter: { type: String },
    resumePath: { type: String },
    resumePublicId: { type: String },
    status: {
      type: String,
      enum: Object.values(ApplicationStatus),
      default: ApplicationStatus.APPLIED,
    },
    statusHistory: [StatusHistorySchema],
    employerNotes: { type: String },
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

// Prevent duplicate applications
ApplicationSchema.index({ job: 1, applicant: 1 }, { unique: true });
ApplicationSchema.index({ applicant: 1 });
ApplicationSchema.index({ status: 1 });

const Application = mongoose.model<IApplication>('Application', ApplicationSchema);

export default Application;
