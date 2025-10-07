/**
 * Mock Prisma Service for Testing
 * Provides type-safe mocks for Prisma operations
 */

import { PrismaClient } from '@prisma/client';
import { DeepMockProxy, mockDeep, mockReset } from 'jest-mock-extended';

export type MockPrismaService = DeepMockProxy<PrismaClient>;

/**
 * Create a mock Prisma service
 */
export function createMockPrismaService(): MockPrismaService {
  return mockDeep<PrismaClient>();
}

/**
 * Reset mock Prisma service
 */
export function resetMockPrismaService(prisma: MockPrismaService): void {
  mockReset(prisma);
}

/**
 * Mock Prisma service instance for reuse
 */
export const mockPrismaService = createMockPrismaService();
