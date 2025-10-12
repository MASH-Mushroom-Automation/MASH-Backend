import { Injectable, Scope } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  createEntityLoader,
  BatchLoader,
} from '../../../common/utils/dataloader.util';

export interface DeviceData {
  id: string;
  name: string;
  serialNumber: string;
  type: any; // DeviceType enum
  status: any; // DeviceStatus enum
  isActive: boolean;
  location: string | null;
  userId: string;
  lastSeen: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({ scope: Scope.REQUEST })
export class DeviceLoader {
  private loader: BatchLoader<string, DeviceData | null>;

  constructor(private prisma: PrismaService) {
    this.loader = createEntityLoader<DeviceData>(
      async (ids: string[]) => {
        const devices = await this.prisma.device.findMany({
          where: {
            id: { in: ids },
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            serialNumber: true,
            type: true,
            status: true,
            isActive: true,
            location: true,
            userId: true,
            lastSeen: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return devices;
      },
      {
        maxBatchSize: 100,
        cache: true,
      },
    );
  }

  async load(id: string): Promise<DeviceData | null> {
    return this.loader.load(id);
  }

  async loadMany(ids: string[]): Promise<(DeviceData | null | Error)[]> {
    return this.loader.loadMany(ids);
  }

  clear(id: string): void {
    this.loader.clear(id);
  }

  clearAll(): void {
    this.loader.clearAll();
  }

  prime(id: string, device: DeviceData): void {
    this.loader.prime(id, device);
  }
}
