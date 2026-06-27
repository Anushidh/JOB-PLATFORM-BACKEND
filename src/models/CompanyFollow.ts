import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICompanyFollow extends Document {
  _id: Types.ObjectId;
  employee: Types.ObjectId;
  company: Types.ObjectId;
  createdAt: Date;
}

const CompanyFollowSchema = new Schema<ICompanyFollow>({
  employee: { type: Schema.Types.ObjectId, ref: 'Employee', required: true },
  company: { type: Schema.Types.ObjectId, ref: 'Company', required: true },
}, { timestamps: true });

CompanyFollowSchema.index({ employee: 1, company: 1 }, { unique: true });
CompanyFollowSchema.index({ company: 1 });

const CompanyFollow = mongoose.model<ICompanyFollow>('CompanyFollow', CompanyFollowSchema);
export default CompanyFollow;
