import { PrismaClient, Device } from '@prisma/client';

/**
 * Seed Sensors
 * Creates 30 sensors (2-3 per device)
 */
export async function seedSensors(prisma: PrismaClient, devices: Device[]) {
  const sensorTypes = [
    { type: 'temperature', unit: '°C', minValue: -10, maxValue: 50 },
    { type: 'humidity', unit: '%', minValue: 0, maxValue: 100 },
    { type: 'co2', unit: 'ppm', minValue: 0, maxValue: 5000 },
    { type: 'light', unit: 'lux', minValue: 0, maxValue: 100000 },
    { type: 'ph', unit: 'pH', minValue: 0, maxValue: 14 },
    { type: 'pressure', unit: 'kPa', minValue: 80, maxValue: 120 },
    { type: 'moisture', unit: '%', minValue: 0, maxValue: 100 },
  ];

  const sensors: any[] = [];

  for (const device of devices) {
    // Each device gets 2-3 sensors
    const sensorCount = Math.floor(Math.random() * 2) + 2;
    const deviceSensorTypes = sensorTypes
      .sort(() => 0.5 - Math.random())
      .slice(0, sensorCount);

    for (const sensorConfig of deviceSensorTypes) {
      const sensor = await prisma.sensor.create({
        data: {
          deviceId: device.id,
          type: sensorConfig.type,
          name: `${device.name} - ${sensorConfig.type.charAt(0).toUpperCase() + sensorConfig.type.slice(1)} Sensor`,
          unit: sensorConfig.unit,
          minValue: sensorConfig.minValue,
          maxValue: sensorConfig.maxValue,
          calibration: {
            offset: (Math.random() - 0.5) * 2, // -1 to +1
            scale: 0.98 + Math.random() * 0.04, // 0.98 to 1.02
            lastCalibrated: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          },
          isActive: true,
        },
      });

      sensors.push(sensor);

      // Create threshold alerts for some sensors
      if (Math.random() > 0.7) { // 30% of sensors have threshold alerts
        const isHighAlert = Math.random() > 0.5;
        const thresholdValue = isHighAlert
          ? sensorConfig.maxValue * 0.9
          : sensorConfig.minValue * 1.1;

        await prisma.alert.create({
          data: {
            deviceId: device.id,
            sensorId: sensor.id,
            type: 'threshold',
            severity: 'medium',
            title: `${sensor.name} ${isHighAlert ? 'High' : 'Low'} Threshold`,
            message: `${sensor.name} has ${isHighAlert ? 'exceeded maximum' : 'fallen below minimum'} threshold`,
            threshold: {
              sensorType: sensorConfig.type,
              condition: isHighAlert ? 'greater_than' : 'less_than',
              value: thresholdValue,
              unit: sensorConfig.unit,
            },
            isActive: true,
            isResolved: true,
            resolvedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          },
        });
      }
    }
  }

  return sensors;
}
