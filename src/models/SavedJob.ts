import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISavedJob extends Document {
  _id: Types.ObjectId;
  employee: Types.ObjectId;
  job: Types.ObjectId;
  createdAt: Date;
}

const SavedJobSchema = new Schema<ISavedJob>(
  {
    employee: {
      type: Schema.Types.ObjectId,
      ref: 'Employee',
      required: true,
    },
    job: {
      type: Schema.Types.ObjectId,
      ref: 'Job',
      required: true,
    },
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

// Prevent duplicate saves
SavedJobSchema.index({ employee: 1, job: 1 }, { unique: true });
SavedJobSchema.index({ employee: 1, createdAt: -1 });

const SavedJob = mongoose.model<ISavedJob>('SavedJob', SavedJobSchema);

export default SavedJob;
