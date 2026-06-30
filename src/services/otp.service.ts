import crypto from 'crypto';
import type Redis from 'ioredis';
import { ApiError } from '../utils/apiError';
import { EmailService } from './email.service';

const OTP_LENGTH = 6;
const OTP_EXPIRY_SECONDS = 300;
const OTP_MAX_ATTEMPTS = 5;
const OTP_COOLDOWN_SECONDS = 60;

export class OtpService {
  constructor(
    private readonly redis: Redis,
    private readonly emailService: EmailService,
  ) {}

  private getOtpKey(email: string, purpose: string): string {
    return `otp:${purpose}:${email}`;
  }

  private getAttemptsKey(email: string, purpose: string): string {
    return `otp_attempts:${purpose}:${email}`;
  }

  private getCooldownKey(email: string, purpose: string): string {
    return `otp_cooldown:${purpose}:${email}`;
  }

  private generateOtp(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  async sendOtp(email: string, purpose: string): Promise<{ otp: string; expiresIn: number }> {
    const cooldownKey = this.getCooldownKey(email, purpose);
    const cooldownExists = await this.redis.get(cooldownKey);
    if (cooldownExists) {
      const ttl = await this.redis.ttl(cooldownKey);
      throw ApiError.badRequest(`Please wait ${ttl} seconds before requesting a new OTP`);
    }

    const otp = this.generateOtp();
    const otpKey = this.getOtpKey(email, purpose);

    await this.redis.set(otpKey, otp, 'EX', OTP_EXPIRY_SECONDS);
    await this.redis.set(cooldownKey, '1', 'EX', OTP_COOLDOWN_SECONDS);

    const attemptsKey = this.getAttemptsKey(email, purpose);
    await this.redis.del(attemptsKey);

    await this.emailService.sendOtp(email, otp);

    console.log(`[OTP] Sent to ${email} (expires in ${OTP_EXPIRY_SECONDS}s)`);

    return { otp, expiresIn: OTP_EXPIRY_SECONDS };
  }

  async verifyOtp(email: string, purpose: string, otp: string): Promise<boolean> {
    const otpKey = this.getOtpKey(email, purpose);
    const attemptsKey = this.getAttemptsKey(email, purpose);

    const attempts = await this.redis.get(attemptsKey);
    if (attempts && parseInt(attempts, 10) >= OTP_MAX_ATTEMPTS) {
      await this.redis.del(otpKey);
      throw ApiError.badRequest('Too many failed attempts. Please request a new OTP.');
    }

    const storedOtp = await this.redis.get(otpKey);
    if (!storedOtp) {
      throw ApiError.badRequest('OTP expired or not found. Please request a new one.');
    }

    if (storedOtp !== otp) {
      await this.redis.incr(attemptsKey);
      await this.redis.expire(attemptsKey, OTP_EXPIRY_SECONDS);
      throw ApiError.badRequest('Invalid OTP');
    }

    await this.redis.del(otpKey);
    await this.redis.del(attemptsKey);

    return true;
  }
}
