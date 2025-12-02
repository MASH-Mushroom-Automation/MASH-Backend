/**
 * OAuth User Data Interface
 * Normalized user data from OAuth providers (Google, Facebook)
 */
export interface OAuthUserData {
  /** OAuth provider user ID (sub for Google, id for Facebook) */
  id: string;

  /** User email address */
  email: string;

  /** User first name */
  firstName: string;

  /** User last name */
  lastName: string;

  /** Profile picture URL */
  imageUrl?: string;

  /** Email verification status from provider */
  emailVerified: boolean;

  /** OAuth provider name */
  provider: 'google' | 'facebook';
}

/**
 * OAuth Provider Type
 */
export type OAuthProvider = 'google' | 'facebook';
