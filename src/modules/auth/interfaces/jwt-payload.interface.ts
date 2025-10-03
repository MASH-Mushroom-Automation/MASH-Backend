export interface JwtPayload {
  sub: string; // User ID
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface SessionInfo {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  isActive: boolean;
  lastActivity: Date;
}
