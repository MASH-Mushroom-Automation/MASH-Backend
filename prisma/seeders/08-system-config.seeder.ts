import { PrismaClient } from '@prisma/client';

/**
 * Seed System Configuration
 * Creates system-wide configuration settings
 */
export async function seedSystemConfig(prisma: PrismaClient) {
  const configs = [
    {
      key: 'site.name',
      value: 'MASH - Mushroom Automation System Hub',
      description: 'Website name displayed in header and metadata',
      category: 'general',
      isPublic: true,
    },
    {
      key: 'site.description',
      value: 'Automated mushroom cultivation system with IoT monitoring and e-commerce platform',
      description: 'Website description for SEO',
      category: 'general',
      isPublic: true,
    },
    {
      key: 'site.email',
      value: 'MASH.Mushroom.Automation@gmail.com',
      description: 'Primary contact email',
      category: 'general',
      isPublic: true,
    },
    {
      key: 'site.phone',
      value: '+63 917 123 4567',
      description: 'Primary contact phone number',
      category: 'general',
      isPublic: true,
    },
    {
      key: 'maintenance.mode',
      value: false,
      description: 'Enable/disable maintenance mode',
      category: 'system',
      isPublic: false,
    },
    {
      key: 'orders.tax_rate',
      value: 0.12,
      description: 'Tax rate for orders (12% VAT in Philippines)',
      category: 'ecommerce',
      isPublic: false,
    },
    {
      key: 'orders.shipping_fee',
      value: 100,
      description: 'Default shipping fee in PHP',
      category: 'ecommerce',
      isPublic: false,
    },
    {
      key: 'orders.free_shipping_threshold',
      value: 1000,
      description: 'Minimum order amount for free shipping in PHP',
      category: 'ecommerce',
      isPublic: true,
    },
    {
      key: 'alerts.email_notifications',
      value: true,
      description: 'Send email notifications for alerts',
      category: 'notifications',
      isPublic: false,
    },
    {
      key: 'alerts.critical_threshold',
      value: 3,
      description: 'Number of critical alerts before escalation',
      category: 'notifications',
      isPublic: false,
    },
    {
      key: 'sensors.reading_interval',
      value: 300,
      description: 'Sensor reading interval in seconds (5 minutes)',
      category: 'iot',
      isPublic: false,
    },
    {
      key: 'sensors.data_retention_days',
      value: 90,
      description: 'Number of days to retain sensor data',
      category: 'iot',
      isPublic: false,
    },
    {
      key: 'devices.offline_threshold',
      value: 3600,
      description: 'Seconds before device is considered offline (1 hour)',
      category: 'iot',
      isPublic: false,
    },
    {
      key: 'analytics.dashboard_refresh',
      value: 30,
      description: 'Dashboard auto-refresh interval in seconds',
      category: 'analytics',
      isPublic: false,
    },
    {
      key: 'security.max_login_attempts',
      value: 5,
      description: 'Maximum failed login attempts before lockout',
      category: 'security',
      isPublic: false,
    },
    {
      key: 'security.lockout_duration',
      value: 1800,
      description: 'Account lockout duration in seconds (30 minutes)',
      category: 'security',
      isPublic: false,
    },
    {
      key: 'products.low_stock_threshold',
      value: 10,
      description: 'Quantity threshold for low stock alerts',
      category: 'inventory',
      isPublic: false,
    },
    {
      key: 'products.auto_reorder',
      value: false,
      description: 'Automatically create reorder requests for low stock',
      category: 'inventory',
      isPublic: false,
    },
  ];

  const createdConfigs: any[] = [];

  for (const config of configs) {
    const created = await prisma.systemConfig.create({
      data: config,
    });
    createdConfigs.push(created);
  }

  return createdConfigs;
}
