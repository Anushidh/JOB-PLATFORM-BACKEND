import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import { IEmployee } from '../types';
import env from '../config/env';

const WorkExperienceSchema = new Schema(
  {
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    current: { type: Boolean, default: false },
    description: { type: String },
  },
  { _id: false }
);

const EducationSchema = new Schema(
  {
    institution: { type: String, required: true },
    degree: { type: String, required: true },
    fieldOfStudy: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date },
    current: { type: Boolean, default: false },
  },
  { _id: false }
);

const EmployeeSchema = new Schema<IEmployee>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
      select: false,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: false,
      trim: true,
      default: '',
    },
    phone: { type: String },
    avatar: { type: String },
    isActive: { type: Boolean, default: true },
    isSuspended: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    isVerified: { type: Boolean, default: false },
    billingState: { type: String },
    lastActiveAt: { type: Date },
    // Employee-specific fields
    skills: [{ type: String }],
    experience: [WorkExperienceSchema],
    education: [EducationSchema],
    portfolioLinks: [{ type: String }],
    resumePath: { type: String },
    resumePublicId: { type: String },
    bio: { type: String },
    headline: { type: String },
    location: { type: String },
    expectedSalary: { type: Number },
    preferredJobType: [{ type: String }],
    preferredWorkMode: [{ type: String }],
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes
EmployeeSchema.index({ skills: 1 });
EmployeeSchema.index({ location: 1 });

// Hash password before saving
EmployeeSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(env.BCRYPT_SALT_ROUNDS);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

// Compare password method
EmployeeSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const Employee = mongoose.model<IEmployee>('Employee', EmployeeSchema);

export default Employee;
