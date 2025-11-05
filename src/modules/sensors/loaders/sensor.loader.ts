import { Injectable, Scope } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { createEntityLoader, BatchLoader } from '../../../common/utils/dataloader.util';

export interface SensorData {
  id: string;
  name: string;
  type: string;
  unit: string | null;
  deviceId: string;
  isActive: boolean;
  calibration: any | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({ scope: Scope.REQUEST })
export class SensorLoader {
  private loader: BatchLoader<string, SensorData | null>;

  constructor(private prisma: PrismaService) {
    this.loader = createEntityLoader<SensorData>(
      async (ids: string[]) => {
        const sensors = await this.prisma.sensor.findMany({
          where: {
            id: { in: ids },
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            type: true,
            unit: true,
            deviceId: true,
            isActive: true,
            calibration: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return sensors;
      },
      {
        maxBatchSize: 100,
        cache: true,
      },
    );
  }

  async load(id: string): Promise<SensorData | null> {
    return this.loader.load(id);
  }

  async loadMany(ids: string[]): Promise<(SensorData | null | Error)[]> {
    return this.loader.loadMany(ids);
  }

  clear(id: string): void {
    this.loader.clear(id);
  }

  clearAll(): void {
    this.loader.clearAll();
  }

  prime(id: string, sensor: SensorData): void {
    this.loader.prime(id, sensor);
  }
}
