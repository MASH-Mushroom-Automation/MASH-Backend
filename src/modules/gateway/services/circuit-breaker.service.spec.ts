import { Test, TestingModule } from '@nestjs/testing';
import { CircuitBreakerService } from './circuit-breaker.service';
import { PrismaService } from '../../../database/prisma.service';
import { CircuitBreakerStateEnum } from '@prisma/client';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  let prismaService: PrismaService;

  // Mock Prisma service
  const mockPrismaService = {
    circuitBreakerState: {
      findUnique: jest.fn(),
      create: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('canExecute', () => {
    it('should allow execution when circuit is CLOSED', async () => {
      // Arrange
      const serviceName = 'test-service';
      mockPrismaService.circuitBreakerState.findUnique.mockResolvedValue({
        serviceName,
        state: CircuitBreakerStateEnum.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
        nextRetryAt: null,
        openedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      const result = await service.canExecute(serviceName);

      // Assert
      expect(result).toBe(true);
      expect(
        mockPrismaService.circuitBreakerState.findUnique,
      ).toHaveBeenCalledWith({
        where: { serviceName },
      });
    });

    it('should block execution when circuit is OPEN and timeout not expired', async () => {
      // Arrange
      const serviceName = 'test-service';
      const futureDate = new Date(Date.now() + 60000); // 60 seconds in future
      mockPrismaService.circuitBreakerState.findUnique.mockResolvedValue({
        serviceName,
        state: CircuitBreakerStateEnum.OPEN,
        failureCount: 5,
        successCount: 0,
        nextRetryAt: futureDate,
        openedAt: new Date(),
        lastFailureAt: new Date(),
        lastSuccessAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      const result = await service.canExecute(serviceName);

      // Assert
      expect(result).toBe(false);
    });

    it('should allow execution and transition to HALF_OPEN when circuit is OPEN and timeout expired', async () => {
      // Arrange
      const serviceName = 'test-service';
      const pastDate = new Date(Date.now() - 1000); // 1 second in past
      mockPrismaService.circuitBreakerState.findUnique.mockResolvedValue({
        serviceName,
        state: CircuitBreakerStateEnum.OPEN,
        failureCount: 5,
        successCount: 0,
        nextRetryAt: pastDate,
        openedAt: new Date(Date.now() - 61000),
        lastFailureAt: new Date(),
        lastSuccessAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      mockPrismaService.circuitBreakerState.upsert.mockResolvedValue({
        serviceName,
        state: CircuitBreakerStateEnum.HALF_OPEN,
        failureCount: 0,
        successCount: 0,
      });

      // Act
      const result = await service.canExecute(serviceName);

      // Assert
      expect(result).toBe(true);
      expect(mockPrismaService.circuitBreakerState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { serviceName },
          update: expect.objectContaining({
            state: CircuitBreakerStateEnum.HALF_OPEN,
            successCount: 0,
            failureCount: 0,
          }),
        }),
      );
    });

    it('should allow execution when circuit is HALF_OPEN', async () => {
      // Arrange
      const serviceName = 'test-service';
      mockPrismaService.circuitBreakerState.findUnique.mockResolvedValue({
        serviceName,
        state: CircuitBreakerStateEnum.HALF_OPEN,
        failureCount: 0,
        successCount: 1,
        lastFailureAt: null,
        lastSuccessAt: new Date(),
        nextRetryAt: null,
        openedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      const result = await service.canExecute(serviceName);

      // Assert
      expect(result).toBe(true);
    });

    it('should create initial state if service not found', async () => {
      // Arrange
      const serviceName = 'new-service';
      mockPrismaService.circuitBreakerState.findUnique.mockResolvedValue(null);
      mockPrismaService.circuitBreakerState.create.mockResolvedValue({
        serviceName,
        state: CircuitBreakerStateEnum.CLOSED,
        failureCount: 0,
        successCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
        nextRetryAt: null,
        openedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      const result = await service.canExecute(serviceName);

      // Assert
      expect(result).toBe(true);
      expect(mockPrismaService.circuitBreakerState.create).toHaveBeenCalledWith(
        {
          data: {
            serviceName,
            state: CircuitBreakerStateEnum.CLOSED,
            failureCount: 0,
            successCount: 0,
          },
        },
      );
    });
  });

  describe('recordSuccess', () => {
    it('should reset failure count on success in CLOSED state', async () => {
      // Arrange
      const serviceName = 'test-service';
      mockPrismaService.circuitBreakerState.findUnique.mockResolvedValue({
        serviceName,
        state: CircuitBreakerStateEnum.CLOSED,
        failureCount: 2,
        successCount: 5,
        lastFailureAt: new Date(),
        lastSuccessAt: null,
        nextRetryAt: null,
        openedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await service.recordSuccess(serviceName);

      // Assert
      expect(mockPrismaService.circuitBreakerState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { serviceName },
          update: expect.objectContaining({
            failureCount: 0,
            successCount: 6,
            lastSuccessAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should increment success count in HALF_OPEN state', async () => {
      // Arrange
      const serviceName = 'test-service';
      mockPrismaService.circuitBreakerState.findUnique.mockResolvedValue({
        serviceName,
        state: CircuitBreakerStateEnum.HALF_OPEN,
        failureCount: 0,
        successCount: 1,
        lastFailureAt: null,
        lastSuccessAt: new Date(),
        nextRetryAt: null,
        openedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await service.recordSuccess(serviceName);

      // Assert
      expect(mockPrismaService.circuitBreakerState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { serviceName },
          update: expect.objectContaining({
            successCount: 2,
            lastSuccessAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should transition to CLOSED after reaching success threshold in HALF_OPEN', async () => {
      // Arrange
      const serviceName = 'test-service';
      mockPrismaService.circuitBreakerState.findUnique.mockResolvedValue({
        serviceName,
        state: CircuitBreakerStateEnum.HALF_OPEN,
        failureCount: 0,
        successCount: 2, // One away from threshold (3)
        lastFailureAt: null,
        lastSuccessAt: new Date(),
        nextRetryAt: null,
        openedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await service.recordSuccess(serviceName);

      // Assert
      expect(mockPrismaService.circuitBreakerState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { serviceName },
          update: expect.objectContaining({
            state: CircuitBreakerStateEnum.CLOSED,
            failureCount: 0,
            successCount: 0,
            nextRetryAt: null,
            openedAt: null,
          }),
        }),
      );
    });
  });

  describe('recordFailure', () => {
    it('should increment failure count when below threshold', async () => {
      // Arrange
      const serviceName = 'test-service';
      mockPrismaService.circuitBreakerState.findUnique.mockResolvedValue({
        serviceName,
        state: CircuitBreakerStateEnum.CLOSED,
        failureCount: 2,
        successCount: 0,
        lastFailureAt: null,
        lastSuccessAt: null,
        nextRetryAt: null,
        openedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await service.recordFailure(serviceName);

      // Assert
      expect(mockPrismaService.circuitBreakerState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { serviceName },
          update: expect.objectContaining({
            failureCount: 3,
            lastFailureAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should transition to OPEN when failure threshold reached', async () => {
      // Arrange
      const serviceName = 'test-service';
      mockPrismaService.circuitBreakerState.findUnique.mockResolvedValue({
        serviceName,
        state: CircuitBreakerStateEnum.CLOSED,
        failureCount: 4, // One away from threshold (5)
        successCount: 0,
        lastFailureAt: new Date(),
        lastSuccessAt: null,
        nextRetryAt: null,
        openedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await service.recordFailure(serviceName);

      // Assert
      expect(mockPrismaService.circuitBreakerState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { serviceName },
          update: expect.objectContaining({
            state: CircuitBreakerStateEnum.OPEN,
            openedAt: expect.any(Date),
            nextRetryAt: expect.any(Date),
          }),
        }),
      );
    });

    it('should immediately reopen circuit on any failure in HALF_OPEN state', async () => {
      // Arrange
      const serviceName = 'test-service';
      mockPrismaService.circuitBreakerState.findUnique.mockResolvedValue({
        serviceName,
        state: CircuitBreakerStateEnum.HALF_OPEN,
        failureCount: 0,
        successCount: 1,
        lastFailureAt: null,
        lastSuccessAt: new Date(),
        nextRetryAt: null,
        openedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Act
      await service.recordFailure(serviceName);

      // Assert
      expect(mockPrismaService.circuitBreakerState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { serviceName },
          update: expect.objectContaining({
            state: CircuitBreakerStateEnum.OPEN,
            openedAt: expect.any(Date),
            nextRetryAt: expect.any(Date),
          }),
        }),
      );
    });
  });

  describe('reset', () => {
    it('should manually reset circuit to CLOSED state', async () => {
      // Arrange
      const serviceName = 'test-service';

      // Act
      await service.reset(serviceName);

      // Assert
      expect(mockPrismaService.circuitBreakerState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { serviceName },
          update: expect.objectContaining({
            state: CircuitBreakerStateEnum.CLOSED,
            failureCount: 0,
            successCount: 0,
            nextRetryAt: null,
            openedAt: null,
          }),
        }),
      );
    });
  });

  describe('getAllStates', () => {
    it('should return all circuit breaker states', async () => {
      // Arrange
      const mockStates = [
        {
          serviceName: 'service-1',
          state: CircuitBreakerStateEnum.CLOSED,
          failureCount: 0,
          successCount: 10,
          lastFailureAt: null,
          lastSuccessAt: new Date(),
          nextRetryAt: null,
          openedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          serviceName: 'service-2',
          state: CircuitBreakerStateEnum.OPEN,
          failureCount: 5,
          successCount: 0,
          lastFailureAt: new Date(),
          lastSuccessAt: null,
          nextRetryAt: new Date(Date.now() + 60000),
          openedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.circuitBreakerState.findMany.mockResolvedValue(
        mockStates,
      );

      // Act
      const result = await service.getAllStates();

      // Assert
      expect(result).toEqual(mockStates);
      expect(
        mockPrismaService.circuitBreakerState.findMany,
      ).toHaveBeenCalledWith({
        orderBy: { serviceName: 'asc' },
      });
    });
  });

  describe('getStatistics', () => {
    it('should return circuit breaker statistics', async () => {
      // Arrange
      const mockStates = [
        {
          serviceName: 'service-1',
          state: CircuitBreakerStateEnum.CLOSED,
          failureCount: 0,
          successCount: 10,
          lastFailureAt: null,
          lastSuccessAt: new Date(),
          nextRetryAt: null,
          openedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          serviceName: 'service-2',
          state: CircuitBreakerStateEnum.OPEN,
          failureCount: 5,
          successCount: 0,
          lastFailureAt: new Date(),
          lastSuccessAt: null,
          nextRetryAt: new Date(Date.now() + 60000),
          openedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          serviceName: 'service-3',
          state: CircuitBreakerStateEnum.HALF_OPEN,
          failureCount: 0,
          successCount: 1,
          lastFailureAt: null,
          lastSuccessAt: new Date(),
          nextRetryAt: null,
          openedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrismaService.circuitBreakerState.findMany.mockResolvedValue(
        mockStates,
      );

      // Act
      const result = await service.getStatistics();

      // Assert
      expect(result.total).toBe(3);
      expect(result.closed).toBe(1);
      expect(result.open).toBe(1);
      expect(result.halfOpen).toBe(1);
      expect(result.states).toHaveLength(3);
      expect(result.states[0]).toMatchObject({
        serviceName: 'service-1',
        state: CircuitBreakerStateEnum.CLOSED,
        failureCount: 0,
        successCount: 10,
      });
    });

    it('should return empty statistics when no states exist', async () => {
      // Arrange
      mockPrismaService.circuitBreakerState.findMany.mockResolvedValue([]);

      // Act
      const result = await service.getStatistics();

      // Assert
      expect(result.total).toBe(0);
      expect(result.closed).toBe(0);
      expect(result.open).toBe(0);
      expect(result.halfOpen).toBe(0);
      expect(result.states).toHaveLength(0);
    });
  });
});
