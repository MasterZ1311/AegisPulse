import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { UserRole } from '@aegispulse/types';
import { getConfig } from '../config/env';

export interface TokenPayload {
  sub: string;
  username: string;
  fullName: string;
  role: UserRole;
  assignedWardIds: string[];
  type: 'access' | 'refresh';
  jti: string;
  iat: number;
  exp: number;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresInSeconds: number;
  user: {
    userId: string;
    username: string;
    fullName: string;
    role: UserRole;
    assignedWardIds: string[];
  };
}

export class TokenRevocationStore {
  private revokedJtis = new Set<string>();
  private userRevocationTimestamps = new Map<string, number>();

  public revokeToken(jti: string): void {
    this.revokedJtis.add(jti);
  }

  public revokeAllUserSessions(userId: string): void {
    this.userRevocationTimestamps.set(userId, Math.floor(Date.now() / 1000));
  }

  public isRevoked(jti: string, userId?: string, issuedAt?: number): boolean {
    if (this.revokedJtis.has(jti)) {
      return true;
    }
    if (userId && issuedAt && this.userRevocationTimestamps.has(userId)) {
      const revokedAt = this.userRevocationTimestamps.get(userId)!;
      if (issuedAt <= revokedAt) {
        return true;
      }
    }
    return false;
  }

  public reset(): void {
    this.revokedJtis.clear();
    this.userRevocationTimestamps.clear();
  }
}

export const tokenRevocationStore = new TokenRevocationStore();

function base64UrlEncode(str: string): string {
  return Buffer.from(str, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

export class TokenService {
  private getSecret(): string {
    const config = getConfig();
    return config.jwtSecret;
  }

  private signSegment(data: string, secret: string): string {
    return createHmac('sha256', secret)
      .update(data)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  /**
   * Generates a signed, cryptographic HMAC-SHA256 JWT token.
   */
  public generateToken(
    user: {
      userId: string;
      username: string;
      fullName: string;
      role: UserRole;
      assignedWardIds: string[];
    },
    type: 'access' | 'refresh' = 'access',
    lifetimeSeconds?: number
  ): { token: string; jti: string; exp: number } {
    const secret = this.getSecret();
    const nowSec = Math.floor(Date.now() / 1000);
    const ttl = lifetimeSeconds ?? (type === 'access' ? 900 : 604800); // 15 min or 7 days
    const exp = nowSec + ttl;
    const jti = randomBytes(16).toString('hex');

    const header = {
      alg: 'HS256',
      typ: 'JWT',
    };

    const payload: TokenPayload = {
      sub: user.userId,
      username: user.username,
      fullName: user.fullName,
      role: user.role,
      assignedWardIds: user.assignedWardIds,
      type,
      jti,
      iat: nowSec,
      exp,
    };

    const headerEncoded = base64UrlEncode(JSON.stringify(header));
    const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
    const signature = this.signSegment(`${headerEncoded}.${payloadEncoded}`, secret);

    const token = `${headerEncoded}.${payloadEncoded}.${signature}`;
    return { token, jti, exp };
  }

  /**
   * Issues both Access and Refresh tokens for an authenticated user.
   */
  public issueTokens(user: {
    userId: string;
    username: string;
    fullName: string;
    role: UserRole;
    assignedWardIds: string[];
  }): IssuedTokens {
    const access = this.generateToken(user, 'access', 900); // 15 mins
    const refresh = this.generateToken(user, 'refresh', 604800); // 7 days

    return {
      accessToken: access.token,
      refreshToken: refresh.token,
      tokenType: 'Bearer',
      expiresInSeconds: 900,
      user,
    };
  }

  /**
   * Cryptographically verifies a token's HMAC-SHA256 signature, expiration, and revocation status.
   */
  public verifyToken(
    token: string,
    expectedType?: 'access' | 'refresh'
  ): TokenPayload {
    if (!token || typeof token !== 'string') {
      throw new Error('Token is missing or not a string.');
    }

    const segments = token.split('.');
    if (segments.length !== 3) {
      throw new Error('Malformed token format. Expected 3 segments.');
    }

    const [headerEncoded, payloadEncoded, signatureProvided] = segments;
    const secret = this.getSecret();
    const expectedSignature = this.signSegment(`${headerEncoded}.${payloadEncoded}`, secret);

    // Timing-safe signature comparison prevents timing attack leakage
    const sigProvidedBuf = Buffer.from(signatureProvided);
    const expectedSigBuf = Buffer.from(expectedSignature);

    if (
      sigProvidedBuf.length !== expectedSigBuf.length ||
      !timingSafeEqual(sigProvidedBuf, expectedSigBuf)
    ) {
      throw new Error('Invalid token signature. Token may have been forged or tampered with.');
    }

    let payload: TokenPayload;
    try {
      payload = JSON.parse(base64UrlDecode(payloadEncoded));
    } catch {
      throw new Error('Failed to parse token payload.');
    }

    // Expiration verification
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && nowSec > payload.exp) {
      throw new Error(`Token expired at ${new Date(payload.exp * 1000).toISOString()} (current time: ${new Date().toISOString()}).`);
    }

    // Token type verification
    if (expectedType && payload.type !== expectedType) {
      throw new Error(`Invalid token type. Expected '${expectedType}', got '${payload.type}'.`);
    }

    // Revocation / Blacklist verification
    if (tokenRevocationStore.isRevoked(payload.jti, payload.sub, payload.iat)) {
      throw new Error('Token has been revoked / logged out.');
    }

    return payload;
  }
}

export const tokenService = new TokenService();
