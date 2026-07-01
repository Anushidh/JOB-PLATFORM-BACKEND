import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import { IEmployer } from '../types';
import env from '../config/env';

const EmployerSchema = new Schema<IEmployer>(
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
      required: true,
      trim: true,
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
    // Employer-specific fields
    company: { type: Schema.Types.ObjectId, ref: 'Company' },
    position: { type: String },
    department: { type: String },
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
EmployerSchema.index({ company: 1 });

// Hash password before saving
EmployerSchema.pre('save', async function (next) {
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
EmployerSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

const Employer = mongoose.model<IEmployer>('Employer', EmployerSchema);

export default Employer;
