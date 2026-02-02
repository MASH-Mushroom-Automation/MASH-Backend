import { Test, TestingModule } from '@nestjs/testing';
import { ShippingService, ShippingAddress } from './shipping.service';
import { PrometheusService } from '../../monitoring/prometheus/prometheus.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('ShippingService', () => {
  let service: ShippingService;
  let prometheusService: jest.Mocked<PrometheusService>;

  const ncrAddress: ShippingAddress = {
    region: 'NCR',
    province: 'Metro Manila',
    city: 'Quezon City',
    barangay: 'Commonwealth',
    addressLine1: '123 Main St',
  };

  const luzonNorthAddress: ShippingAddress = {
    region: 'ILOCOS', // Service recognizes ILOCOS as LUZON_NORTH
    province: 'Ilocos Norte',
    city: 'Laoag',
    barangay: 'Barangay 1',
    addressLine1: '456 North St',
  };

  const visayasAddress: ShippingAddress = {
    region: 'VISAYAS',
    province: 'Cebu',
    city: 'Cebu City',
    barangay: 'Lahug',
    addressLine1: '789 Central Ave',
  };

  const mindanaoAddress: ShippingAddress = {
    region: 'MINDANAO',
    province: 'Davao del Sur',
    city: 'Davao City',
    barangay: 'Poblacion',
    addressLine1: '101 South St',
  };

  beforeEach(async () => {
    const mockPrometheusService = {
      recordShippingCalculation: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ShippingService,
        { provide: PrometheusService, useValue: mockPrometheusService },
      ],
    }).compile();

    service = module.get<ShippingService>(ShippingService);
    prometheusService = module.get(PrometheusService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateShipping', () => {
    it('should calculate standard shipping for NCR', () => {
      const result = service.calculateShipping(
        new Decimal(1.0),
        ncrAddress,
        'STANDARD',
      );

      expect(result.toNumber()).toBe(50); // Base rate 50 * 1.0 multiplier
      expect(prometheusService.recordShippingCalculation).toHaveBeenCalledWith('STANDARD', 'NCR');
    });

    it('should calculate express shipping for NCR', () => {
      const result = service.calculateShipping(
        new Decimal(1.0),
        ncrAddress,
        'EXPRESS',
      );

      expect(result.toNumber()).toBe(150); // Base rate 150 * 1.0 multiplier
    });

    it('should calculate same-day shipping for NCR', () => {
      const result = service.calculateShipping(
        new Decimal(1.0),
        ncrAddress,
        'SAME_DAY',
      );

      expect(result.toNumber()).toBe(300); // Base rate 300 * 1.0 multiplier
    });

    it('should apply regional multiplier for Luzon North', () => {
      const result = service.calculateShipping(
        new Decimal(1.0),
        luzonNorthAddress,
        'STANDARD',
      );

      expect(result.toNumber()).toBe(65); // Base rate 50 * 1.3 multiplier = 65
    });

    it('should apply regional multiplier for Visayas', () => {
      const result = service.calculateShipping(
        new Decimal(1.0),
        visayasAddress,
        'STANDARD',
      );

      expect(result.toNumber()).toBe(75); // Base rate 50 * 1.5 multiplier
    });

    it('should apply regional multiplier for Mindanao', () => {
      const result = service.calculateShipping(
        new Decimal(1.0),
        mindanaoAddress,
        'STANDARD',
      );

      expect(result.toNumber()).toBe(85); // Base rate 50 * 1.7 multiplier
    });

    it('should apply weight surcharge for weights over 1kg', () => {
      const result = service.calculateShipping(
        new Decimal(3.0),
        ncrAddress,
        'STANDARD',
      );

      // Base 50 + (2kg * 20) = 90
      expect(result.toNumber()).toBe(90);
    });

    it('should default to STANDARD method', () => {
      const result = service.calculateShipping(
        new Decimal(1.0),
        ncrAddress,
      );

      expect(result.toNumber()).toBe(50);
      expect(prometheusService.recordShippingCalculation).toHaveBeenCalledWith('STANDARD', 'NCR');
    });

    it('should record metrics for every shipping calculation', () => {
      service.calculateShipping(new Decimal(1.0), ncrAddress, 'STANDARD');
      service.calculateShipping(new Decimal(1.0), luzonNorthAddress, 'EXPRESS');

      expect(prometheusService.recordShippingCalculation).toHaveBeenCalledTimes(2);
    });

    it('should record correct method and region labels', () => {
      service.calculateShipping(new Decimal(1.0), visayasAddress, 'EXPRESS');

      expect(prometheusService.recordShippingCalculation).toHaveBeenCalledWith('EXPRESS', 'VISAYAS');
    });
  });

  describe('getShippingOptions', () => {
    it('should return standard and express options for non-NCR regions', () => {
      const options = service.getShippingOptions(new Decimal(1.0), visayasAddress);

      expect(options).toHaveLength(2);
      expect(options.map(o => o.method)).toContain('STANDARD');
      expect(options.map(o => o.method)).toContain('EXPRESS');
      expect(options.map(o => o.method)).not.toContain('SAME_DAY');
    });

    it('should include same-day option for NCR', () => {
      const options = service.getShippingOptions(new Decimal(1.0), ncrAddress);

      expect(options).toHaveLength(3);
      expect(options.map(o => o.method)).toContain('SAME_DAY');
    });

    it('should include estimated days for each option', () => {
      const options = service.getShippingOptions(new Decimal(1.0), visayasAddress);

      options.forEach(option => {
        expect(option).toHaveProperty('estimatedDays');
        expect(typeof option.estimatedDays).toBe('number');
      });
    });
  });

  describe('estimateShipping', () => {
    it('should return shipping calculation with all options', () => {
      const result = service.estimateShipping(new Decimal(1.0), ncrAddress, 'STANDARD');

      expect(result).toHaveProperty('selectedMethod');
      expect(result).toHaveProperty('cost');
      expect(result).toHaveProperty('estimatedDays');
      expect(result).toHaveProperty('availableOptions');
    });

    it('should select the preferred method', () => {
      const result = service.estimateShipping(new Decimal(1.0), ncrAddress, 'EXPRESS');

      expect(result.selectedMethod).toBe('EXPRESS');
    });

    it('should default to STANDARD if preferred method not specified', () => {
      const result = service.estimateShipping(new Decimal(1.0), ncrAddress);

      expect(result.selectedMethod).toBe('STANDARD');
    });
  });

  describe('validateAddress', () => {
    it('should return true for valid address', () => {
      expect(service.validateAddress(ncrAddress)).toBe(true);
    });

    it('should return false for address missing required fields', () => {
      const invalidAddress = {
        region: 'NCR',
        province: 'Metro Manila',
        city: '',
        barangay: 'Commonwealth',
        addressLine1: '123 Main St',
      } as ShippingAddress;

      expect(service.validateAddress(invalidAddress)).toBe(false);
    });

    it('should return false for address without region', () => {
      const invalidAddress = {
        region: '',
        province: 'Metro Manila',
        city: 'Quezon City',
        barangay: 'Commonwealth',
        addressLine1: '123 Main St',
      } as ShippingAddress;

      expect(service.validateAddress(invalidAddress)).toBe(false);
    });
  });
});
