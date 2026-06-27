import mongoose, { Schema, Document, Types } from 'mongoose';
import { UserRole } from '../types';

export interface IProfileView extends Document {
  _id: Types.ObjectId;
  profileOwner: Types.ObjectId;
  profileOwnerRole: UserRole;
  viewer: Types.ObjectId;
  viewerRole: UserRole;
  viewedAt: Date;
}

const ProfileViewSchema = new Schema<IProfileView>(
  {
    profileOwner: { type: Schema.Types.ObjectId, required: true },
    profileOwnerRole: { type: String, enum: Object.values(UserRole), required: true },
    viewer: { type: Schema.Types.ObjectId, required: true },
    viewerRole: { type: String, enum: Object.values(UserRole), required: true },
    viewedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// One view per viewer per profile per day (prevent spam)
ProfileViewSchema.index(
  { profileOwner: 1, viewer: 1, viewedAt: 1 },
  { unique: false }
);
ProfileViewSchema.index({ profileOwner: 1, viewedAt: -1 });
ProfileViewSchema.index({ viewer: 1 });

const ProfileView = mongoose.model<IProfileView>('ProfileView', ProfileViewSchema);

export default ProfileView;
