import jwt from 'jsonwebtoken';
import type Redis from 'ioredis';
import env from '../config/env';
import { TokenPayload, UserRole } from '../types';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class TokenService {
  constructor(private readonly redis: Redis) {}

  private getRefreshTokenKey(userId: string, role: UserRole): string {
    return `refresh_token:${role}:${userId}`;
  }

  private getBlacklistKey(token: string): string {
    return `blacklist:${token}`;
  }

  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions['expiresIn'],
    });
  }

  generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRY as jwt.SignOptions['expiresIn'],
    });
  }

  async generateTokenPair(userId: string, role: UserRole): Promise<TokenPair> {
    const payload: TokenPayload = { userId, role };
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    const key = this.getRefreshTokenKey(userId, role);
    await this.redis.set(key, refreshToken, 'EX', env.JWT_REFRESH_EXPIRY_SECONDS);

    return { accessToken, refreshToken };
  }

  async verifyRefreshToken(token: string): Promise<TokenPayload> {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;

    const key = this.getRefreshTokenKey(decoded.userId, decoded.role);
    const storedToken = await this.redis.get(key);

    if (!storedToken || storedToken !== token) {
      throw new Error('Invalid refresh token');
    }

    return decoded;
  }

  async rotateRefreshToken(userId: string, role: UserRole): Promise<TokenPair> {
    const key = this.getRefreshTokenKey(userId, role);
    await this.redis.del(key);
    return this.generateTokenPair(userId, role);
  }

  async revokeRefreshToken(userId: string, role: UserRole): Promise<void> {
    const key = this.getRefreshTokenKey(userId, role);
    await this.redis.del(key);
  }

  async blacklistAccessToken(token: string): Promise<void> {
    const decoded = jwt.decode(token) as { exp?: number } | null;
    if (!decoded || !decoded.exp) return;

    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      const key = this.getBlacklistKey(token);
      await this.redis.set(key, '1', 'EX', ttl);
    }
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const key = this.getBlacklistKey(token);
    const result = await this.redis.get(key);
    return result !== null;
  }

  async revokeAllUserTokens(userId: string, role: UserRole): Promise<void> {
    const key = this.getRefreshTokenKey(userId, role);
    await this.redis.del(key);
  }
}
