/**
 * Device Factory
 * 
 * Factory for creating test Device instances for IoT testing.
 */

import { faker } from '@faker-js/faker';
import { DeviceType, DeviceStatus } from '@prisma/client';

export interface DeviceFactoryOptions {
  id?: string;
  name?: string;
  type?: DeviceType;
  serialNumber?: string;
  status?: DeviceStatus;
  userId?: string;
  location?: string;
  description?: string;
  firmware?: string;
  ipAddress?: string;
  macAddress?: string;
  lastSeen?: Date;
  isActive?: boolean;
}

export class DeviceFactory {
  /**
   * Create a single device with optional overrides
   */
  static create(overrides?: Partial<DeviceFactoryOptions>) {
    const type = overrides?.type || faker.helpers.arrayElement(Object.values(DeviceType));
    
    return {
      id: overrides?.id || faker.string.uuid(),
      name: overrides?.name || `${type} ${faker.number.int({ min: 1, max: 100 })}`,
      type,
      serialNumber: overrides?.serialNumber || `SN-${faker.string.alphanumeric(12).toUpperCase()}`,
      status: overrides?.status || DeviceStatus.ONLINE,
      userId: overrides?.userId || faker.string.uuid(),
      location: overrides?.location || `${faker.helpers.arrayElement(['Farm', 'Greenhouse', 'Lab'])} ${faker.number.int({ min: 1, max: 10 })}`,
      description: overrides?.description || faker.lorem.sentence(),
      firmware: overrides?.firmware || `v${faker.system.semver()}`,
      ipAddress: overrides?.ipAddress || faker.internet.ip(),
      macAddress: overrides?.macAddress || faker.internet.mac(),
      lastSeen: overrides?.lastSeen || faker.date.recent({ days: 1 }),
      isActive: overrides?.isActive !== undefined ? overrides.isActive : true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /**
   * Create online device
   */
  static createOnline(overrides?: Partial<DeviceFactoryOptions>) {
    return this.create({
      ...overrides,
      status: DeviceStatus.ONLINE,
      lastSeen: new Date(),
    });
  }

  /**
   * Create offline device
   */
  static createOffline(overrides?: Partial<DeviceFactoryOptions>) {
    return this.create({
      ...overrides,
      status: DeviceStatus.OFFLINE,
      lastSeen: faker.date.past({ years: 1 }),
    });
  }

  /**
   * Create device by type
   */
  static createByType(type: DeviceType, overrides?: Partial<DeviceFactoryOptions>) {
    return this.create({ ...overrides, type });
  }

  /**
   * Create multiple devices
   */
  static createMany(count: number, overrides?: Partial<DeviceFactoryOptions>) {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Create devices for a specific user
   */
  static createForUser(userId: string, count: number = 3) {
    return this.createMany(count, { userId });
  }
}
