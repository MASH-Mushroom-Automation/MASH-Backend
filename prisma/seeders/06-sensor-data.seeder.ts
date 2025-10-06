import { PrismaClient, Device, Sensor, User } from '@prisma/client';

/**
 * Seed Sensor Data
 * Creates 500+ sensor readings over 30 days
 */
export async function seedSensorData(
  prisma: PrismaClient,
  devices: Device[],
  sensors: Sensor[],
  users: User[],
) {
  const onlineDevices = devices.filter(d => d.status === 'ONLINE');
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  let totalRecords = 0;

  // Helper function to generate realistic sensor values
  const generateValue = (sensorType: string, timestamp: Date): number => {
    const hour = timestamp.getHours();
    const dayNight = hour >= 6 && hour <= 18 ? 1 : 0.8; // Day vs night variation

    switch (sensorType) {
      case 'temperature':
        return 20 + Math.random() * 8 * dayNight; // 20-28°C during day
      case 'humidity':
        return 60 + Math.random() * 30; // 60-90%
      case 'co2':
        return 400 + Math.random() * 600 * (1 - dayNight * 0.3); // Higher at night
      case 'light':
        return dayNight === 1 ? 10000 + Math.random() * 40000 : Math.random() * 100;
      case 'ph':
        return 6.0 + Math.random() * 2; // pH 6-8
      case 'pressure':
        return 95 + Math.random() * 10; // 95-105 kPa
      case 'moisture':
        return 50 + Math.random() * 40; // 50-90%
      default:
        return Math.random() * 100;
    }
  };

  // Helper function to determine data quality
  const getQuality = (value: number, min: number, max: number): string => {
    if (value < min || value > max) return 'out_of_range';
    if (value < min * 1.1 || value > max * 0.9) return 'warning';
    return 'good';
  };

  // Generate data for each online device
  for (const device of onlineDevices) {
    const deviceSensors = sensors.filter(s => s.deviceId === device.id);
    const deviceOwner = users.find(u => u.id === device.userId);

    if (!deviceOwner || deviceSensors.length === 0) continue;

    // Generate readings every 30 minutes for 30 days
    const intervalMinutes = 30;
    const totalIntervals = (30 * 24 * 60) / intervalMinutes; // ~1440 readings per sensor

    // Limit to ~20 readings per sensor to avoid too much data
    const readingsPerSensor = Math.min(20, Math.floor(totalIntervals / 72)); // Sample every ~2 hours

    for (const sensor of deviceSensors) {
      const sensorDataBatch: any[] = [];

      for (let i = 0; i < readingsPerSensor; i++) {
        const timestamp = new Date(
          thirtyDaysAgo.getTime() + 
          (i * (30 * 24 * 60 * 60 * 1000)) / readingsPerSensor
        );

        const value = generateValue(sensor.type, timestamp);
        const quality = getQuality(
          value,
          sensor.minValue || 0,
          sensor.maxValue || 100,
        );

        sensorDataBatch.push({
          deviceId: device.id,
          sensorId: sensor.id,
          userId: deviceOwner.id,
          type: sensor.type,
          value: Math.round(value * 100) / 100, // 2 decimal places
          unit: sensor.unit,
          quality,
          timestamp,
        });
      }

      // Batch insert for performance
      await prisma.sensorData.createMany({
        data: sensorDataBatch,
      });

      totalRecords += sensorDataBatch.length;
    }
  }

  return totalRecords;
}
