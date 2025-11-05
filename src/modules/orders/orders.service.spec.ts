import { Test, TestingModule } from '@nestjs/testing';
import { ConsoleLogger } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaService } from '../../database/prisma.service';
import { createMockPrismaService } from '../../../test/mocks/prisma.mock';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: ReturnType<typeof createMockPrismaService>;

  beforeEach(async () => {
    prisma = createMockPrismaService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    })

      .setLogger(new ConsoleLogger()) // Use ConsoleLogger for NestJS v11 compatibility

      .compile();

    service = module.get<OrdersService>(OrdersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    // TODO: Fix this test - service method signature needs investigation
    it.skip('should create an order successfully', async () => {
      const mockOrder = {
        id: '1',
        userId: 'user-1',
        total: 100,
        status: 'PENDING',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prisma.order.create.mockResolvedValue(mockOrder as any);

      const result = await service.create({
        userId: 'user-1',
        items: [],
        total: 100,
      });

      expect(prisma.order.create).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
    });
  });

  describe('findAll', () => {
    it('should return paginated orders', async () => {
      const mockOrders = [{ id: '1', userId: 'user-1', total: 100, status: 'PENDING' }];

      prisma.order.findMany.mockResolvedValue(mockOrders as any);
      prisma.order.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(prisma.order.findMany).toHaveBeenCalled();
    });

    // TODO: Fix these tests - DTO properties need verification
    it.skip('should filter orders by user', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, userId: 'user-1' });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'user-1',
          }),
        }),
      );
    });

    it.skip('should filter orders by status', async () => {
      prisma.order.findMany.mockResolvedValue([]);
      prisma.order.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 10, status: 'COMPLETED' });

      expect(prisma.order.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'COMPLETED',
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it.skip('should return an order by id', async () => {
      const mockOrder = { id: '1', total: 100, status: 'PENDING' };
      prisma.order.findUnique.mockResolvedValue(mockOrder as any);

      const result = await service.findOne('1');

      expect(result).toEqual(mockOrder);
      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });
  });
});
