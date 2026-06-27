import crypto from 'crypto';
import redis from '../config/redis';
import { ApiError } from '../utils/apiError';
import emailService from './email.service';

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 300; // 5 minutes
const OTP_MAX_ATTEMPTS = 5;
const OTP_COOLDOWN_SECONDS = 60; // 1 minute between resends

class OtpService {
  private getOtpKey(email: string, purpose: string): string {
    return `otp:${purpose}:${email}`;
  }

  private getAttemptsKey(email: string, purpose: string): string {
    return `otp_attempts:${purpose}:${email}`;
  }

  private getCooldownKey(email: string, purpose: string): string {
    return `otp_cooldown:${purpose}:${email}`;
  }

  /** Generates a 6-digit cryptographically secure OTP */
  private generateOtp(): string {
    // Generate a cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    return otp;
  }

  /** Generates an OTP, stores it in Redis with expiry, enforces cooldown, and sends it via email */
  async sendOtp(email: string, purpose: string): Promise<{ otp: string; expiresIn: number }> {
    // Check cooldown (prevent spam)
    const cooldownKey = this.getCooldownKey(email, purpose);
    const cooldownExists = await redis.get(cooldownKey);
    if (cooldownExists) {
      const ttl = await redis.ttl(cooldownKey);
      throw ApiError.badRequest(`Please wait ${ttl} seconds before requesting a new OTP`);
    }

    const otp = this.generateOtp();
    const otpKey = this.getOtpKey(email, purpose);

    // Store OTP in Redis with expiry
    await redis.set(otpKey, otp, 'EX', OTP_EXPIRY_SECONDS);

    // Set cooldown
    await redis.set(cooldownKey, '1', 'EX', OTP_COOLDOWN_SECONDS);

    // Reset attempts counter
    const attemptsKey = this.getAttemptsKey(email, purpose);
    await redis.del(attemptsKey);

    // Send OTP via email
    await emailService.sendOtp(email, otp);

    console.log(`[OTP] Sent to ${email} (expires in ${OTP_EXPIRY_SECONDS}s)`);

    return { otp, expiresIn: OTP_EXPIRY_SECONDS };
  }

  /** Validates an OTP against Redis, enforces max attempts, and deletes it on success */
  async verifyOtp(email: string, purpose: string, otp: string): Promise<boolean> {
    const otpKey = this.getOtpKey(email, purpose);
    const attemptsKey = this.getAttemptsKey(email, purpose);

    // Check attempts
    const attempts = await redis.get(attemptsKey);
    if (attempts && parseInt(attempts) >= OTP_MAX_ATTEMPTS) {
      // Delete the OTP - too many attempts
      await redis.del(otpKey);
      throw ApiError.badRequest('Too many failed attempts. Please request a new OTP.');
    }

    // Get stored OTP
    const storedOtp = await redis.get(otpKey);
    if (!storedOtp) {
      throw ApiError.badRequest('OTP expired or not found. Please request a new one.');
    }

    // Compare
    if (storedOtp !== otp) {
      // Increment attempts
      await redis.incr(attemptsKey);
      await redis.expire(attemptsKey, OTP_EXPIRY_SECONDS);
      throw ApiError.badRequest('Invalid OTP');
    }

    // OTP is valid - delete it so it can't be reused
    await redis.del(otpKey);
    await redis.del(attemptsKey);

    return true;
  }
}

export default new OtpService();
