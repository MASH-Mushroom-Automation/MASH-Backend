import { PrismaClient, User, DeviceType, DeviceStatus } from '@prisma/client';

/**
 * Seed Devices
 * Creates 15 IoT devices for mushroom cultivation
 */
export async function seedDevices(prisma: PrismaClient, users: User[]) {
  // Get grower users
  const growers = users.filter(u => u.role === 'GROWER');

  const deviceTypes = [
    { type: DeviceType.MUSHROOM_CHAMBER, count: 5 },
    { type: DeviceType.ENVIRONMENTAL_SENSOR, count: 3 },
    { type: DeviceType.HVAC_CONTROLLER, count: 3 },
    { type: DeviceType.pH_SENSOR, count: 2 },
    { type: DeviceType.HUMIDITY_CONTROLLER, count: 2 },
  ];

  const locations = [
    'Building A - Floor 1',
    'Building A - Floor 2',
    'Building B - Floor 1',
    'Greenhouse 1',
    'Greenhouse 2',
    'Laboratory Room 1',
    'Laboratory Room 2',
    'Storage Room',
    'Processing Area',
    'Quality Control Lab',
  ];

  const devices: any[] = [];
  let serialCounter = 1000;

  for (const { type, count } of deviceTypes) {
    for (let i = 0; i < count; i++) {
      const owner = growers[Math.floor(Math.random() * growers.length)];
      const isOnline = Math.random() > 0.2; // 80% online
      const location = locations[Math.floor(Math.random() * locations.length)];

      const device = await prisma.device.create({
        data: {
          name: `${type.replace(/_/g, ' ')} ${i + 1}`,
          type,
          serialNumber: `MASH-${type.slice(0, 4).toUpperCase()}-${String(serialCounter++).padStart(4, '0')}`,
          status: isOnline 
            ? DeviceStatus.ONLINE 
            : Math.random() > 0.5 
              ? DeviceStatus.OFFLINE 
              : DeviceStatus.MAINTENANCE,
          userId: owner.id,
          location,
          description: `${type.replace(/_/g, ' ')} for monitoring and controlling mushroom cultivation environment`,
          firmware: `v${Math.floor(Math.random() * 3) + 1}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 20)}`,
          ipAddress: `192.168.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
          macAddress: Array.from({ length: 6 }, () => 
            Math.floor(Math.random() * 256).toString(16).padStart(2, '0')
          ).join(':'),
          lastSeen: isOnline 
            ? new Date(Date.now() - Math.random() * 3600000) // Within last hour
            : new Date(Date.now() - Math.random() * 86400000 * 7), // Within last week
          isActive: true,
        },
      });

      devices.push(device);

      // Create device commands
      if (isOnline) {
        await prisma.deviceCommand.create({
          data: {
            deviceId: device.id,
            command: 'GET_STATUS',
            parameters: { requestId: `req_${Date.now()}` },
            status: 'acknowledged',
            response: {
              status: 'ok',
              temperature: 20 + Math.random() * 10,
              humidity: 60 + Math.random() * 30,
              timestamp: new Date().toISOString(),
            },
            acknowledgedAt: new Date(),
          },
        });
      }

      // Create alerts for offline/maintenance devices
      if (!isOnline || device.status === DeviceStatus.MAINTENANCE) {
        await prisma.alert.create({
          data: {
            deviceId: device.id,
            type: device.status === DeviceStatus.MAINTENANCE ? 'maintenance' : 'offline',
            severity: device.status === DeviceStatus.MAINTENANCE ? 'medium' : 'high',
            title: device.status === DeviceStatus.MAINTENANCE 
              ? `${device.name} Under Maintenance`
              : `${device.name} Offline`,
            message: device.status === DeviceStatus.MAINTENANCE
              ? `Device is currently undergoing scheduled maintenance`
              : `Device has not reported status for extended period`,
            threshold: device.status === DeviceStatus.OFFLINE 
              ? { maxOfflineMinutes: 60 } as any
              : undefined,
            isActive: true,
            isResolved: false,
          },
        });
      }
    }
  }

  return devices;
}
