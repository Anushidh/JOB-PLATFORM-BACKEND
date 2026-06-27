import mongoose from 'mongoose';
import env from '../config/env';
import Admin from '../models/Admin';
import { UserRole } from '../types';

const seedAdmin = async (): Promise<void> => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const adminEmail = process.env.ADMIN_EMAIL || 'admin@jobplatform.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email: adminEmail });
    if (existingAdmin) {
      console.log(`Admin already exists: ${adminEmail}`);
      process.exit(0);
    }

    const admin = await Admin.create({
      email: adminEmail,
      password: adminPassword,
      role: UserRole.ADMIN,
      isActive: true,
      isSuspended: false,
    });

    console.log('Admin created successfully:');
    console.log(`  Email: ${admin.email}`);
    console.log(`  ID: ${admin._id}`);
    console.log('\n⚠️  Change the default password immediately after first login!');

    process.exit(0);
  } catch (error) {
    console.error('Failed to seed admin:', error);
    process.exit(1);
  }
};

seedAdmin();
