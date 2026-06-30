import mongoose, { Schema } from 'mongoose';
import { ICompany } from '../types';

const CompanySchema = new Schema<ICompany>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: { type: String },
    logoUrl: { type: String },
    website: { type: String },
    industry: { type: String },
    size: { type: String },
    location: { type: String },
    foundedYear: { type: Number },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'Employer',
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

CompanySchema.index({ name: 'text', description: 'text' });
CompanySchema.index({ owner: 1 });
CompanySchema.index({ industry: 1 });

const Company = mongoose.model<ICompany>('Company', CompanySchema);

export default Company;
