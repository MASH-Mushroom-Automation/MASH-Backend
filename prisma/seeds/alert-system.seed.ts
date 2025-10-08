import { PrismaClient, AlertCategory, AlertPriority, NotificationChannel } from '@prisma/client';

const prisma = new PrismaClient();

async function seedAlertSystem() {
  console.log('🌱 Seeding Alert & Notification System...');

  // 1. Create admin user for system (if not exists)
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@mash-backend.local' },
    update: {},
    create: {
      clerkId: 'system_admin',
      email: 'admin@mash-backend.local',
      firstName: 'System',
      lastName: 'Administrator',
      role: 'ADMIN',
    },
  });

  console.log(`✅ Admin user: ${adminUser.email}`);

  // 2. Create Email Notification Template
  const emailTemplate = await prisma.notificationTemplate.create({
    data: {
      name: 'sensor-alert-email',
      description: 'Email template for sensor threshold alerts',
      category: AlertCategory.SENSOR,
      channel: NotificationChannel.EMAIL,
      subject: '🚨 MASH Alert: {{title}}',
      body: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #d32f2f;">⚠️ Alert Notification</h2>
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px;">
            <h3>{{title}}</h3>
            <p><strong>Category:</strong> {{category}}</p>
            <p><strong>Priority:</strong> {{priority}}</p>
            <p><strong>Time:</strong> {{timestamp}}</p>
            <hr style="border: 1px solid #ddd;">
            <p>{{message}}</p>
          </div>
          <div style="margin-top: 20px; padding: 15px; background: #e3f2fd; border-radius: 8px;">
            <p><strong>Event Details:</strong></p>
            <ul>
              <li><strong>Sensor:</strong> {{sensorName}}</li>
              <li><strong>Current Value:</strong> {{currentValue}}</li>
              <li><strong>Threshold:</strong> {{threshold}}</li>
            </ul>
          </div>
          <p style="margin-top: 20px; color: #666; font-size: 12px;">
            This is an automated alert from MASH Mushroom Automation System.
          </p>
        </div>
      `,
      variables: {
        title: 'Alert title',
        category: 'Alert category',
        priority: 'Alert priority',
        timestamp: 'Alert timestamp',
        message: 'Alert message',
        sensorName: 'Sensor identifier',
        currentValue: 'Current sensor reading',
        threshold: 'Configured threshold value',
      },
      isActive: true,
      createdBy: adminUser.id,
    },
  });

  console.log(`✅ Email template created: ${emailTemplate.name}`);

  // 3. Create SMS Template
  const smsTemplate = await prisma.notificationTemplate.create({
    data: {
      name: 'sensor-alert-sms',
      description: 'SMS template for urgent sensor alerts',
      category: AlertCategory.SENSOR,
      channel: NotificationChannel.SMS,
      body: 'MASH ALERT: {{title}} - {{sensorName}}: {{currentValue}} (Threshold: {{threshold}}). Priority: {{priority}}',
      variables: {
        title: 'Alert title',
        sensorName: 'Sensor name',
        currentValue: 'Current value',
        threshold: 'Threshold',
        priority: 'Priority level',
      },
      isActive: true,
      createdBy: adminUser.id,
    },
  });

  console.log(`✅ SMS template created: ${smsTemplate.name}`);

  // 4. Create Sample Alert Rule: High Temperature
  const highTempRule = await prisma.alertRule.create({
    data: {
      name: 'High Temperature Warning',
      description: 'Alert when temperature exceeds 30°C in growing area',
      category: AlertCategory.SENSOR,
      priority: AlertPriority.HIGH,
      eventType: 'sensor.temperature',
      condition: {
        operator: 'GT', // Greater Than
        threshold: 30,
        field: 'value',
      },
      activeHours: {
        start: '00:00',
        end: '23:59',
        days: [1, 2, 3, 4, 5, 6, 7], // All days
      },
      cooldownMinutes: 15,
      isActive: true,
      createdBy: adminUser.id,
    },
  });

  console.log(`✅ Alert rule created: ${highTempRule.name}`);

  // 5. Create Sample Alert Rule: Low Humidity
  const lowHumidityRule = await prisma.alertRule.create({
    data: {
      name: 'Low Humidity Critical',
      description: 'Critical alert when humidity drops below 60%',
      category: AlertCategory.SENSOR,
      priority: AlertPriority.CRITICAL,
      eventType: 'sensor.humidity',
      condition: {
        operator: 'LT', // Less Than
        threshold: 60,
        field: 'value',
      },
      activeHours: {
        start: '06:00',
        end: '22:00',
        days: [1, 2, 3, 4, 5, 6, 7],
      },
      cooldownMinutes: 10, // Shorter cooldown for critical alerts
      isActive: true,
      createdBy: adminUser.id,
    },
  });

  console.log(`✅ Alert rule created: ${lowHumidityRule.name}`);

  // 6. Create Alert Rule Recipients
  await prisma.alertRuleRecipient.create({
    data: {
      ruleId: highTempRule.id,
      recipientType: 'EMAIL',
      email: 'MASH.Mushroom.Automation@gmail.com',
      enableEmail: true,
      enableSms: false,
      enablePush: true,
      enableInApp: true,
    },
  });

  await prisma.alertRuleRecipient.create({
    data: {
      ruleId: lowHumidityRule.id,
      recipientType: 'EMAIL',
      email: 'MASH.Mushroom.Automation@gmail.com',
      enableEmail: true,
      enableSms: true, // Enable SMS for critical alerts
      enablePush: true,
      enableInApp: true,
    },
  });

  console.log(`✅ Recipients configured for alert rules`);

  // 7. Create Escalation Policy
  const escalationPolicy = await prisma.alertEscalationPolicy.create({
    data: {
      name: 'Critical Sensor Escalation',
      description: 'Escalate critical sensor alerts if not acknowledged within 30 minutes',
      priority: [AlertPriority.CRITICAL],
      category: [AlertCategory.SENSOR, AlertCategory.SYSTEM],
      unacknowledgedMin: 30,
      steps: [
        {
          level: 1,
          delay: 15, // 15 minutes
          recipients: ['MASH.Mushroom.Automation@gmail.com'],
          channels: ['EMAIL', 'PUSH'],
        },
        {
          level: 2,
          delay: 30, // Total 30 minutes
          recipients: ['MASH.Mushroom.Automation@gmail.com'],
          channels: ['EMAIL', 'SMS', 'PUSH'],
        },
      ],
      isActive: true,
    },
  });

  console.log(`✅ Escalation policy created: ${escalationPolicy.name}`);

  console.log('\n✅ Alert & Notification System seeded successfully!');
  console.log('   📧 Email templates: 1');
  console.log('   📱 SMS templates: 1');
  console.log('   ⚠️  Alert rules: 2');
  console.log('   👥 Recipients: 2');
  console.log('   🔺 Escalation policies: 1');
}

seedAlertSystem()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    console.error('\n💡 Make sure you have:');
    console.error('   1. Run database migration: npx prisma migrate dev');
    console.error('   2. Generated Prisma Client: npx prisma generate');
    console.error('   3. Database is running and accessible');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
