import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ShippingService, ShippingAddress, ShippingMethod } from './shipping.service';
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
    region: 'LUZON_NORTH',
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
        ShippingMethod.STANDARD,
        ncrAddress,
        new Decimal(1.0),
      );

      expect(result.toNumber()).toBe(50); // Base rate 50 * 1.0 multiplier
      expect(prometheusService.recordShippingCalculation).toHaveBeenCalledWith('STANDARD', 'NCR');
    });

    it('should calculate express shipping for NCR', () => {
      const result = service.calculateShipping(
        ShippingMethod.EXPRESS,
        ncrAddress,
        new Decimal(1.0),
      );

      expect(result.toNumber()).toBe(150); // Base rate 150 * 1.0 multiplier
    });

    it('should calculate same-day shipping for NCR', () => {
      const result = service.calculateShipping(
        ShippingMethod.SAME_DAY,
        ncrAddress,
        new Decimal(1.0),
      );

      expect(result.toNumber()).toBe(300); // Base rate 300 * 1.0 multiplier
    });

    it('should throw BadRequestException for same-day shipping outside NCR', () => {
      expect(() =>
        service.calculateShipping(ShippingMethod.SAME_DAY, luzonNorthAddress, new Decimal(1.0)),
      ).toThrow(BadRequestException);
      expect(() =>
        service.calculateShipping(ShippingMethod.SAME_DAY, luzonNorthAddress, new Decimal(1.0)),
      ).toThrow('Same-day delivery only available in NCR');
    });

    it('should apply regional multiplier for Luzon North', () => {
      const result = service.calculateShipping(
        ShippingMethod.STANDARD,
        luzonNorthAddress,
        new Decimal(1.0),
      );

      expect(result.toNumber()).toBe(65); // 50 * 1.3 = 65
      expect(prometheusService.recordShippingCalculation).toHaveBeenCalledWith(
        'STANDARD',
        'LUZON_NORTH',
      );
    });

    it('should apply regional multiplier for Visayas', () => {
      const result = service.calculateShipping(
        ShippingMethod.EXPRESS,
        visayasAddress,
        new Decimal(1.0),
      );

      expect(result.toNumber()).toBe(225); // 150 * 1.5 = 225
    });

    it('should add weight surcharge for items over 1kg', () => {
      const result = service.calculateShipping(
        ShippingMethod.STANDARD,
        ncrAddress,
        new Decimal(3.5),
      );

      // Base: 50, Weight surcharge: (3.5 - 1) * 20 = 50
      expect(result.toNumber()).toBe(100);
    });

    it('should apply both regional multiplier and weight surcharge', () => {
      const result = service.calculateShipping(
        ShippingMethod.EXPRESS,
        luzonNorthAddress,
        new Decimal(2.5),
      );

      // Base: 150 * 1.3 = 195, Weight: (2.5 - 1) * 20 = 30
      expect(result.toNumber()).toBe(225);
    });

    it('should not add weight surcharge for items 1kg or under', () => {
      const result = service.calculateShipping(
        ShippingMethod.STANDARD,
        ncrAddress,
        new Decimal(0.5),
      );

      expect(result.toNumber()).toBe(50); // No weight surcharge
    });

    it('should handle exact 1kg weight without surcharge', () => {
      const result = service.calculateShipping(
        ShippingMethod.STANDARD,
        ncrAddress,
        new Decimal(1.0),
      );

      expect(result.toNumber()).toBe(50); // No weight surcharge at exactly 1kg
    });
  });

  describe('determineRegion', () => {
    it('should identify NCR from Metro Manila province', () => {
      const result = service.determineRegion('Metro Manila');
      expect(result).toBe('NCR');
    });

    it('should identify Luzon North provinces', () => {
      expect(service.determineRegion('Ilocos Norte')).toBe('LUZON_NORTH');
      expect(service.determineRegion('Cagayan')).toBe('LUZON_NORTH');
      expect(service.determineRegion('Pangasinan')).toBe('LUZON_NORTH');
    });

    it('should identify Luzon South provinces', () => {
      expect(service.determineRegion('Cavite')).toBe('LUZON_SOUTH');
      expect(service.determineRegion('Laguna')).toBe('LUZON_SOUTH');
      expect(service.determineRegion('Batangas')).toBe('LUZON_SOUTH');
    });

    it('should identify Visayas provinces', () => {
      expect(service.determineRegion('Cebu')).toBe('VISAYAS');
      expect(service.determineRegion('Bohol')).toBe('VISAYAS');
      expect(service.determineRegion('Leyte')).toBe('VISAYAS');
    });

    it('should identify Mindanao provinces', () => {
      expect(service.determineRegion('Davao del Sur')).toBe('MINDANAO');
      expect(service.determineRegion('Zamboanga del Norte')).toBe('MINDANAO');
      expect(service.determineRegion('Bukidnon')).toBe('MINDANAO');
    });

    it('should default to LUZON_SOUTH for unknown provinces', () => {
      expect(service.determineRegion('Unknown Province')).toBe('LUZON_SOUTH');
    });

    it('should be case-insensitive', () => {
      expect(service.determineRegion('metro manila')).toBe('NCR');
      expect(service.determineRegion('CEBU')).toBe('VISAYAS');
      expect(service.determineRegion('IlOcOs NoRtE')).toBe('LUZON_NORTH');
    });
  });

  describe('getShippingOptions', () => {
    it('should return all shipping options for NCR', () => {
      const options = service.getShippingOptions(ncrAddress, new Decimal(1.0));

      expect(options).toHaveLength(3);
      expect(options[0].method).toBe(ShippingMethod.STANDARD);
      expect(options[1].method).toBe(ShippingMethod.EXPRESS);
      expect(options[2].method).toBe(ShippingMethod.SAME_DAY);
    });

    it('should exclude same-day delivery for non-NCR', () => {
      const options = service.getShippingOptions(luzonNorthAddress, new Decimal(1.0));

      expect(options).toHaveLength(2);
      expect(options.some((o) => o.method === ShippingMethod.SAME_DAY)).toBe(false);
    });

    it('should include correct prices for each option', () => {
      const options = service.getShippingOptions(ncrAddress, new Decimal(1.0));

      const standard = options.find((o) => o.method === ShippingMethod.STANDARD);
      expect(standard?.cost.toNumber()).toBe(50);

      const express = options.find((o) => o.method === ShippingMethod.EXPRESS);
      expect(express?.cost.toNumber()).toBe(150);

      const sameDay = options.find((o) => o.method === ShippingMethod.SAME_DAY);
      expect(sameDay?.cost.toNumber()).toBe(300);
    });

    it('should include delivery estimates', () => {
      const options = service.getShippingOptions(ncrAddress, new Decimal(1.0));

      const standard = options.find((o) => o.method === ShippingMethod.STANDARD);
      expect(standard?.estimatedDays).toBe('3-5 business days');

      const express = options.find((o) => o.method === ShippingMethod.EXPRESS);
      expect(express?.estimatedDays).toBe('1-2 business days');

      const sameDay = options.find((o) => o.method === ShippingMethod.SAME_DAY);
      expect(sameDay?.estimatedDays).toBe('Same day');
    });

    it('should apply weight surcharge to all options', () => {
      const options = service.getShippingOptions(ncrAddress, new Decimal(3.0));

      const standard = options.find((o) => o.method === ShippingMethod.STANDARD);
      expect(standard?.cost.toNumber()).toBe(90); // 50 + (2 * 20)

      const express = options.find((o) => o.method === ShippingMethod.EXPRESS);
      expect(express?.cost.toNumber()).toBe(190); // 150 + (2 * 20)
    });

    it('should apply regional multipliers to all options', () => {
      const options = service.getShippingOptions(visayasAddress, new Decimal(1.0));

      const standard = options.find((o) => o.method === ShippingMethod.STANDARD);
      expect(standard?.cost.toNumber()).toBe(75); // 50 * 1.5
    });
  });

  describe('estimateShipping', () => {
    it('should estimate shipping for default standard method', () => {
      const result = service.estimateShipping(ncrAddress, new Decimal(1.0));

      expect(result.method).toBe(ShippingMethod.STANDARD);
      expect(result.cost.toNumber()).toBe(50);
      expect(result.estimatedDays).toBe('3-5 business days');
    });

    it('should estimate shipping for specified method', () => {
      const result = service.estimateShipping(
        ncrAddress,
        new Decimal(1.0),
        ShippingMethod.EXPRESS,
      );

      expect(result.method).toBe(ShippingMethod.EXPRESS);
      expect(result.cost.toNumber()).toBe(150);
    });

    it('should calculate region from address', () => {
      const result = service.estimateShipping(luzonNorthAddress, new Decimal(1.0));

      expect(result.cost.toNumber()).toBe(65); // 50 * 1.3 for Luzon North
    });

    it('should apply weight surcharges in estimates', () => {
      const result = service.estimateShipping(ncrAddress, new Decimal(2.5));

      expect(result.cost.toNumber()).toBe(80); // 50 + (1.5 * 20)
    });

    it('should include all required fields in estimate', () => {
      const result = service.estimateShipping(ncrAddress, new Decimal(1.0));

      expect(result).toHaveProperty('method');
      expect(result).toHaveProperty('cost');
      expect(result).toHaveProperty('estimatedDays');
    });
  });

  describe('metrics recording', () => {
    it('should record metrics for every shipping calculation', () => {
      service.calculateShipping(ShippingMethod.STANDARD, ncrAddress, new Decimal(1.0));
      service.calculateShipping(ShippingMethod.EXPRESS, luzonNorthAddress, new Decimal(1.0));

      expect(prometheusService.recordShippingCalculation).toHaveBeenCalledTimes(2);
    });

    it('should record correct method and region labels', () => {
      service.calculateShipping(ShippingMethod.EXPRESS, visayasAddress, new Decimal(1.0));

      expect(prometheusService.recordShippingCalculation).toHaveBeenCalledWith('EXPRESS', 'VISAYAS');
    });
  });
});
