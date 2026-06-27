import jwt from 'jsonwebtoken';
import redis from '../config/redis';
import env from '../config/env';
import { TokenPayload, UserRole } from '../types';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

class TokenService {
  private getRefreshTokenKey(userId: string, role: UserRole): string {
    return `refresh_token:${role}:${userId}`;
  }

  private getBlacklistKey(token: string): string {
    return `blacklist:${token}`;
  }

  /** Signs a JWT access token with the configured secret and expiry */
  generateAccessToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
      expiresIn: env.JWT_ACCESS_EXPIRY as any,
    });
  }

  /** Signs a JWT refresh token with the configured secret and expiry */
  generateRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRY as any,
    });
  }

  /** Generates an access/refresh token pair and stores the refresh token in Redis */
  async generateTokenPair(userId: string, role: UserRole): Promise<TokenPair> {
    const payload: TokenPayload = { userId, role };
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    // Store refresh token in Redis with expiry
    const key = this.getRefreshTokenKey(userId, role);
    await redis.set(key, refreshToken, 'EX', env.JWT_REFRESH_EXPIRY_SECONDS);

    return { accessToken, refreshToken };
  }

  /** Verifies a refresh token's signature and checks it matches the stored token in Redis */
  async verifyRefreshToken(token: string): Promise<TokenPayload> {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;

    // Check if token matches what's stored in Redis
    const key = this.getRefreshTokenKey(decoded.userId, decoded.role);
    const storedToken = await redis.get(key);

    if (!storedToken || storedToken !== token) {
      throw new Error('Invalid refresh token');
    }

    return decoded;
  }

  /** Deletes the old refresh token and issues a fresh token pair */
  async rotateRefreshToken(userId: string, role: UserRole): Promise<TokenPair> {
    // Delete old refresh token
    const key = this.getRefreshTokenKey(userId, role);
    await redis.del(key);

    // Generate new token pair
    return this.generateTokenPair(userId, role);
  }

  /** Removes the user's stored refresh token from Redis */
  async revokeRefreshToken(userId: string, role: UserRole): Promise<void> {
    const key = this.getRefreshTokenKey(userId, role);
    await redis.del(key);
  }

  /** Adds an access token to the Redis blacklist until its original expiry time */
  async blacklistAccessToken(token: string): Promise<void> {
    // Decode without verifying to get expiry
    const decoded = jwt.decode(token) as any;
    if (!decoded || !decoded.exp) return;

    const ttl = decoded.exp - Math.floor(Date.now() / 1000);
    if (ttl > 0) {
      const key = this.getBlacklistKey(token);
      await redis.set(key, '1', 'EX', ttl);
    }
  }

  /** Checks if an access token has been blacklisted (revoked) */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const key = this.getBlacklistKey(token);
    const result = await redis.get(key);
    return result !== null;
  }

  /** Revokes all tokens for a user (used when account is suspended/deleted) */
  async revokeAllUserTokens(userId: string, role: UserRole): Promise<void> {
    const key = this.getRefreshTokenKey(userId, role);
    await redis.del(key);
  }
}

export default new TokenService();
