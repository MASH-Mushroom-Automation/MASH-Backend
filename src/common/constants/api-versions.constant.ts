/**
 * API Version Constants
 * 
 * Centralized API versioning configuration
 */

/**
 * Current API version
 */
export const CURRENT_API_VERSION = 'v1';

/**
 * Supported API versions
 */
export const SUPPORTED_API_VERSIONS = ['v1'] as const;

/**
 * API version type
 */
export type ApiVersion = (typeof SUPPORTED_API_VERSIONS)[number];

/**
 * API version prefix for routes
 */
export const API_VERSION_PREFIX = 'api';

/**
 * Full API prefix (e.g., 'api/v1')
 */
export const FULL_API_PREFIX = `${API_VERSION_PREFIX}/${CURRENT_API_VERSION}`;

/**
 * API versioning configuration
 */
export const API_VERSION_CONFIG = {
  v1: {
    version: 'v1',
    deprecated: false,
    sunsetDate: null,
    description: 'Current stable version',
  },
} as const;

/**
 * Helper function to check if version is supported
 */
export function isVersionSupported(version: string): boolean {
  return SUPPORTED_API_VERSIONS.includes(version as ApiVersion);
}

/**
 * Helper function to check if version is deprecated
 */
export function isVersionDeprecated(version: ApiVersion): boolean {
  return API_VERSION_CONFIG[version]?.deprecated || false;
}

/**
 * Helper function to get full API path
 */
export function getFullApiPath(version: ApiVersion = CURRENT_API_VERSION as ApiVersion): string {
  return `${API_VERSION_PREFIX}/${version}`;
}
