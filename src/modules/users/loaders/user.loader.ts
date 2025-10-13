import { Injectable, Scope } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  createEntityLoader,
  BatchLoader,
} from '../../../common/utils/dataloader.util';

export interface UserData {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: any; // UserRole enum
  isActive: boolean;
  imageUrl: string | null;
  phoneNumber: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({ scope: Scope.REQUEST })
export class UserLoader {
  private loader: BatchLoader<string, UserData | null>;

  constructor(private prisma: PrismaService) {
    this.loader = createEntityLoader<UserData>(
      async (ids: string[]) => {
        const users = await this.prisma.user.findMany({
          where: {
            id: { in: ids },
            isActive: true,
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            isActive: true,
            imageUrl: true,
            phoneNumber: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return users;
      },
      {
        maxBatchSize: 100,
        cache: true,
      },
    );
  }

  async load(id: string): Promise<UserData | null> {
    return this.loader.load(id);
  }

  async loadMany(ids: string[]): Promise<(UserData | null | Error)[]> {
    return this.loader.loadMany(ids);
  }

  clear(id: string): void {
    this.loader.clear(id);
  }

  clearAll(): void {
    this.loader.clearAll();
  }

  prime(id: string, user: UserData): void {
    this.loader.prime(id, user);
  }
}
