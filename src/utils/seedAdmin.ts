import Admin from '../models/Admin';
import { UserRole } from '../types';
import env from '../config/env';

/**
 * Seeds the default admin account if one doesn't already exist.
 * Runs silently on every server startup.
 */
export async function seedAdmin(): Promise<void> {
  try {
    const adminEmail = env.ADMIN_EMAIL || 'admin@hireflow.dev';
    const adminPassword = env.ADMIN_PASSWORD || 'Admin@123456';

    const existing = await Admin.findOne({ email: adminEmail });
    if (existing) return;

    await Admin.create({
      email: adminEmail,
      password: adminPassword,
      role: UserRole.ADMIN,
    });

    console.log(`✅ Admin seeded: ${adminEmail}`);
  } catch (error) {
    console.error('⚠️  Admin seed failed:', error);
    // Don't crash the server — seeding is non-critical
  }
}
