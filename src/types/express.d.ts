// Express Request type extensions
import 'express';

declare module 'express' {
  export interface Request {
    user?: {
      id: string;
      email?: string;
      role?: string;
      [key: string]: any;
    };
    clerkUser?: any;
    sessionId?: string;
  }
}
