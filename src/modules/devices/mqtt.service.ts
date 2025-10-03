import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import * as mqtt from 'mqtt';
import { DevicesGateway } from './devices.gateway';

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient;
  private connected = false;

  constructor(private readonly devicesGateway: DevicesGateway) {}

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect() {
    try {
      // Configure MQTT broker connection
      // For local development, you can use a public broker or set up mosquitto
      const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883';
      const options: mqtt.IClientOptions = {
        clientId: `mash-backend-${Math.random().toString(16).slice(3)}`,
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
        clean: true,
        reconnectPeriod: 5000,
      };

      this.client = mqtt.connect(brokerUrl, options);

      this.client.on('connect', () => {
        this.connected = true;
        this.logger.log('📡 Connected to MQTT broker');

        // Subscribe to device topics
        this.client.subscribe('devices/+/status', (err) => {
          if (err) {
            this.logger.error('Failed to subscribe to device status', err);
          }
        });

        this.client.subscribe('devices/+/data', (err) => {
          if (err) {
            this.logger.error('Failed to subscribe to device data', err);
          }
        });
      });

      this.client.on('message', (topic, message) => {
        this.handleMessage(topic, message);
      });

      this.client.on('error', (error) => {
        this.logger.error('MQTT connection error:', error);
        this.connected = false;
      });

      this.client.on('close', () => {
        this.connected = false;
        this.logger.warn('MQTT connection closed');
      });
    } catch (error) {
      this.logger.error('Failed to connect to MQTT broker:', error);
    }
  }

  private handleMessage(topic: string, message: Buffer) {
    try {
      const data = JSON.parse(message.toString());
      const parts = topic.split('/');

      if (parts.length >= 3) {
        const deviceId = parts[1];
        const messageType = parts[2];

        if (messageType === 'status') {
          // Emit status update via WebSocket
          this.devicesGateway.emitDeviceStatus(deviceId, data);
        } else if (messageType === 'data') {
          // Emit sensor data via WebSocket
          this.devicesGateway.emitDeviceData(deviceId, data);
        }
      }
    } catch (error) {
      this.logger.error('Failed to parse MQTT message:', error);
    }
  }

  async publish(topic: string, message: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.connected) {
        reject(new Error('MQTT client not connected'));
        return;
      }

      this.client.publish(topic, JSON.stringify(message), (error) => {
        if (error) {
          this.logger.error(`Failed to publish to ${topic}:`, error);
          reject(error);
        } else {
          this.logger.log(`Published to ${topic}`);
          resolve();
        }
      });
    });
  }

  async sendCommand(
    deviceId: string,
    command: string,
    parameters: any = {},
  ): Promise<void> {
    const topic = `devices/${deviceId}/command`;
    const payload = {
      command,
      parameters,
      timestamp: new Date().toISOString(),
    };
    return this.publish(topic, payload);
  }

  async updateConfiguration(
    deviceId: string,
    configuration: any,
  ): Promise<void> {
    const topic = `devices/${deviceId}/config`;
    const payload = {
      configuration,
      timestamp: new Date().toISOString(),
    };
    return this.publish(topic, payload);
  }

  async requestStatus(deviceId: string): Promise<void> {
    const topic = `devices/${deviceId}/request/status`;
    return this.publish(topic, { timestamp: new Date().toISOString() });
  }

  private async disconnect() {
    if (this.client) {
      await this.client.endAsync();
      this.logger.log('Disconnected from MQTT broker');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }
}
