/**
 * ============================================================================
 * TEST FIXTURES - Profile Management
 * ============================================================================
 * 
 * Reusable test data for profile management endpoints
 * ============================================================================
 */

export const profileFixtures = {
  validProfile: {
    firstName: 'John',
    lastName: 'Doe',
    bio: 'Software engineer with 5 years of experience',
    phoneNumber: '09171234567',
    address: {
      street: '123 Main St',
      city: 'Manila',
      province: 'Metro Manila',
      postalCode: '1000',
      country: 'Philippines',
    },
  },

  updateProfile: {
    firstName: 'Jane',
    lastName: 'Smith',
    bio: 'Updated bio text',
  },

  invalidEmail: {
    email: 'not-an-email',
  },

  validPreferences: {
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    language: 'en',
    timezone: 'Asia/Manila',
    theme: 'dark',
    currency: 'PHP',
  },

  updatePreferences: {
    emailNotifications: false,
    language: 'es',
    timezone: 'America/New_York',
  },

  invalidLanguage: {
    language: 'invalid_lang_code',
  },

  invalidTimezone: {
    timezone: 'Invalid/Timezone',
  },

  // Avatar test data
  validAvatar: {
    filename: 'avatar.jpg',
    mimetype: 'image/jpeg',
    size: 1024 * 500, // 500KB
  },

  largeAvatar: {
    filename: 'large-avatar.jpg',
    mimetype: 'image/jpeg',
    size: 1024 * 1024 * 10, // 10MB
  },

  invalidAvatar: {
    filename: 'document.pdf',
    mimetype: 'application/pdf',
    size: 1024 * 100,
  },
};

/**
 * Generate test user data
 */
export function generateTestUser(prefix: string = 'test') {
  const timestamp = Date.now();
  return {
    email: `${prefix}.profile.${timestamp}@example.com`,
    password: 'SecurePass123!',
    firstName: `${prefix}First`,
    lastName: `${prefix}Last`,
  };
}

/**
 * Generate random bio
 */
export function generateRandomBio(): string {
  const bios = [
    'Passionate developer building amazing applications',
    'Tech enthusiast exploring new technologies',
    'Full-stack developer with a love for clean code',
    'Software engineer focused on user experience',
    'Creative problem solver with attention to detail',
  ];
  return bios[Math.floor(Math.random() * bios.length)];
}

/**
 * Generate valid Philippine phone number
 */
export function generatePhoneNumber(): string {
  const prefix = ['0917', '0918', '0919', '0920', '0921'];
  const randomPrefix = prefix[Math.floor(Math.random() * prefix.length)];
  const randomDigits = Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
  return `${randomPrefix}${randomDigits}`;
}
