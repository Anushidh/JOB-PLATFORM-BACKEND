import { Document, Types } from 'mongoose';

// User Roles
export enum UserRole {
  EMPLOYER = 'employer',
  EMPLOYEE = 'employee',
  ADMIN = 'admin',
}

// Job Types
export enum JobType {
  FULL_TIME = 'full-time',
  PART_TIME = 'part-time',
  CONTRACT = 'contract',
  INTERNSHIP = 'internship',
  FREELANCE = 'freelance',
}

// Work Mode
export enum WorkMode {
  REMOTE = 'remote',
  HYBRID = 'hybrid',
  ONSITE = 'onsite',
}

// Experience Level
export enum ExperienceLevel {
  ENTRY = 'entry',
  MID = 'mid',
  SENIOR = 'senior',
  LEAD = 'lead',
  EXECUTIVE = 'executive',
}

// Job Status
export enum JobStatus {
  DRAFT = 'draft',
  PENDING = 'pending',
  ACTIVE = 'active',
  CLOSED = 'closed',
  REJECTED = 'rejected',
}

// Application Status
export enum ApplicationStatus {
  APPLIED = 'applied',
  SHORTLISTED = 'shortlisted',
  REJECTED = 'rejected',
  INTERVIEW = 'interview',
  OFFER = 'offer',
  WITHDRAWN = 'withdrawn',
}

// Notification Type
export enum NotificationType {
  APPLICATION_RECEIVED = 'application_received',
  APPLICATION_STATUS_CHANGED = 'application_status_changed',
  JOB_APPROVED = 'job_approved',
  JOB_REJECTED = 'job_rejected',
  ACCOUNT_SUSPENDED = 'account_suspended',
  ACCOUNT_REACTIVATED = 'account_reactivated',
}

// Base user fields shared between Employee and Employer
export interface IBaseUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  isActive: boolean;
  isSuspended: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  isVerified: boolean;
  lastActiveAt?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

// Employee Interface
export interface IEmployee extends IBaseUser {
  skills?: string[];
  experience?: IWorkExperience[];
  education?: IEducation[];
  portfolioLinks?: string[];
  resumePath?: string;
  resumePublicId?: string;
  bio?: string;
  headline?: string;
  location?: string;
  expectedSalary?: number;
  preferredJobType?: string[];
  preferredWorkMode?: string[];
  billingState?: string;
}

// Employer Interface
export interface IEmployer extends IBaseUser {
  company?: Types.ObjectId;
  position?: string;
  department?: string;
  billingState?: string;
}

// Admin Interface
export interface IAdmin extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  role: UserRole.ADMIN;
  comparePassword(candidatePassword: string): Promise<boolean>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkExperience {
  title: string;
  company: string;
  location?: string;
  startDate: Date;
  endDate?: Date;
  current: boolean;
  description?: string;
}

export interface IEducation {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: Date;
  endDate?: Date;
  current: boolean;
}

// Job Interface
export interface IJob extends Document {
  _id: Types.ObjectId;
  title: string;
  description: string;
  company: Types.ObjectId;
  employer: Types.ObjectId;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  location: string;
  jobType: JobType;
  workMode: WorkMode;
  experienceLevel: ExperienceLevel;
  skillsRequired: string[];
  status: JobStatus;
  applicationDeadline?: Date;
  applicationsCount: number;
  isDeleted: boolean;
  deletedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Application Interface
export interface IApplication extends Document {
  _id: Types.ObjectId;
  job: Types.ObjectId;
  applicant: Types.ObjectId;
  coverLetter?: string;
  resumePath?: string;
  resumePublicId?: string;
  status: ApplicationStatus;
  statusHistory: IStatusHistory[];
  employerNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStatusHistory {
  status: ApplicationStatus;
  changedAt: Date;
  note?: string;
}

// Company Interface
export interface ICompany extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  industry?: string;
  size?: string;
  location?: string;
  foundedYear?: number;
  owner: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Notification Interface
export interface INotification extends Document {
  _id: Types.ObjectId;
  recipient: Types.ObjectId;
  recipientRole: UserRole;
  type: NotificationType;
  title: string;
  message: string;
  relatedId?: Types.ObjectId;
  relatedModel?: string;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Token payload stored in JWT
export interface TokenPayload {
  userId: string;
  role: UserRole;
}

// Pagination
export type SubscriptionFeature =
  | 'jobPost'
  | 'application'
  | 'premiumPlacement'
  | 'resumeAccess'
  | 'analyticsAccess'
  | 'messaging'
  | 'profileViewers'
  | 'savedJobs';

export interface PaginationOptions {
  page: number;
  limit: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// API Response
export interface ApiResponseData<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
}
