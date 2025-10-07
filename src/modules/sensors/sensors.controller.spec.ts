import { Test, TestingModule } from '@nestjs/testing';
import { SensorsController } from './sensors.controller';
import { SensorsService } from './sensors.service';
import { mock } from 'jest-mock-extended';

describe('SensorsController', () => {
  let controller: SensorsController;
  let service: jest.Mocked<SensorsService>;

  beforeEach(async () => {
    service = mock<SensorsService>();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SensorsController],
      providers: [
        {
          provide: SensorsService,
          useValue: service,
        },
      ],
    }).compile();

    controller = module.get<SensorsController>(SensorsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
