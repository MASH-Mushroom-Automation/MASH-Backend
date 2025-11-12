# 🔌 MASH IoT Device Integration Guide

**Version:** 1.0.0  
**Last Updated:** November 11, 2025  
**Target Audience:** IoT Developers, Hardware Engineers, System Integrators

---

## 📋 Table of Contents

1. [Introduction](#introduction)
2. [Quick Start](#quick-start)
3. [Device Registration](#device-registration)
4. [MQTT Integration](#mqtt-integration)
5. [WebSocket Integration](#websocket-integration)
6. [Sending Sensor Data](#sending-sensor-data)
7. [Receiving Commands](#receiving-commands)
8. [Health Monitoring](#health-monitoring)
9. [Code Examples](#code-examples)
10. [Troubleshooting](#troubleshooting)

---

## 🎯 Introduction

The MASH IoT Device Management System enables seamless integration of IoT devices for mushroom cultivation automation. This guide will walk you through the complete integration process.

### System Architecture

```
┌─────────────────┐         MQTT/HTTP          ┌──────────────────┐
│  IoT Device     │ ◄─────────────────────────► │  MASH Backend    │
│  (ESP32/etc)    │                              │  (NestJS + MQTT) │
└─────────────────┘                              └──────────────────┘
        │                                                 │
        │                                                 │
        ▼                                                 ▼
  Physical Sensors                                 WebSocket Gateway
  (Temp, Humidity,                                       │
   CO2, etc.)                                            ▼
                                                  Frontend Dashboard
```

### Communication Protocols

- **HTTP/REST**: Device registration, configuration, analytics
- **MQTT**: Real-time sensor data, command delivery
- **WebSocket**: Live dashboard updates, notifications

### Prerequisites

- ✅ MASH Backend account with API access
- ✅ JWT authentication token
- ✅ MQTT client library
- ✅ HTTP client library
- ✅ Network connectivity (WiFi/Ethernet)

---

## 🚀 Quick Start

### Step 1: Get API Credentials

```bash
# Login to get access token
curl -X POST https://mash-backend-api-production.up.railway.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "your-email@example.com",
    "password": "your-password"
  }'

# Save the accessToken from response
```

### Step 2: Register Your Device

```bash
curl -X POST https://mash-backend-api-production.up.railway.app/api/v1/devices \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "deviceId": "MASH-PROTO-001",
    "name": "Mushroom Chamber #1",
    "type": "MUSHROOM_CHAMBER",
    "location": "Greenhouse A",
    "ipAddress": "192.168.1.100",
    "port": 5000
  }'
```

### Step 3: Connect via MQTT

```python
# Python example
import paho.mqtt.client as mqtt

broker = "mqtt.mash.io"
port = 1883
device_id = "MASH-PROTO-001"

client = mqtt.Client()
client.username_pw_set("your_username", "your_password")
client.connect(broker, port)

# Subscribe to commands
client.subscribe(f"devices/{device_id}/command")
```

### Step 4: Send Sensor Data

```python
# Publish sensor readings
sensor_data = {
    "deviceId": device_id,
    "timestamp": "2025-11-11T10:30:00Z",
    "sensors": {
        "temperature": 22.5,
        "humidity": 92.3,
        "co2": 12500
    }
}

client.publish(f"devices/{device_id}/data", json.dumps(sensor_data))
```

---

## 📝 Device Registration

### Required Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deviceId` | string | Yes | Unique device identifier |
| `name` | string | Yes | Human-readable device name |
| `type` | enum | Yes | Device type (MUSHROOM_CHAMBER, SENSOR_NODE, etc.) |
| `location` | string | No | Physical location |
| `ipAddress` | string | No | Device IP address |
| `port` | number | No | Device port number |
| `configuration` | object | No | Device-specific configuration |

### Device Types

- `MUSHROOM_CHAMBER`: Full automation chamber
- `SENSOR_NODE`: Standalone sensor unit
- `ACTUATOR_NODE`: Control unit only
- `GATEWAY`: Network gateway device

### Registration Flow

```
1. User creates account → Receives JWT token
2. Device powers on → Connects to WiFi
3. Device calls registration API → Receives device ID
4. Device stores credentials → Ready for operation
5. Device connects to MQTT → Starts publishing data
```

### Example: Complete Registration (Node.js)

```javascript
const axios = require('axios');

async function registerDevice() {
  const response = await axios.post(
    'https://mash-backend-api-production.up.railway.app/api/v1/devices',
    {
      deviceId: 'MASH-NODE-' + Math.random().toString(36).substr(2, 9),
      name: 'Smart Mushroom Chamber',
      type: 'MUSHROOM_CHAMBER',
      location: 'Lab Building 1, Room 3',
      ipAddress: getLocalIP(),
      port: 5000,
      configuration: {
        spawningTempMin: 20,
        spawningTempMax: 25,
        fruitingTempMin: 15,
        fruitingTempMax: 20,
        spawningHumidityMin: 90,
        spawningHumidityMax: 95
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.ACCESS_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );

  console.log('Device registered:', response.data.data.id);
  return response.data.data;
}
```

---

## 🔌 MQTT Integration

### Connection Details

```
Broker: mqtt.mash.io (or your self-hosted broker)
Port: 1883 (standard), 8883 (TLS)
Protocol: MQTT v3.1.1 or v5.0
QoS: 0 (at most once), 1 (at least once), 2 (exactly once)
Keep-Alive: 60 seconds
```

### Topic Structure

#### Device → Server Topics

```
devices/{deviceId}/status       → Device status updates
devices/{deviceId}/data         → Sensor data
devices/{deviceId}/health       → Health metrics
devices/{deviceId}/response/{commandId} → Command responses
```

#### Server → Device Topics

```
devices/{deviceId}/command      → Control commands
devices/{deviceId}/config       → Configuration updates
devices/{deviceId}/request/status → Status requests
```

### Message Formats

#### Status Update

```json
{
  "deviceId": "MASH-PROTO-001",
  "status": "ONLINE",
  "timestamp": "2025-11-11T10:30:00Z",
  "mode": "SPAWNING",
  "firmware": "v1.2.3",
  "ipAddress": "192.168.1.100"
}
```

#### Sensor Data

```json
{
  "deviceId": "MASH-PROTO-001",
  "timestamp": "2025-11-11T10:30:00Z",
  "sensors": {
    "temperature": 22.5,
    "humidity": 92.3,
    "co2": 12500,
    "light": 350
  },
  "actuators": {
    "blower_fan": false,
    "exhaust_fan": false,
    "humidifier": true,
    "led_lights": false
  }
}
```

#### Health Metrics

```json
{
  "deviceId": "MASH-PROTO-001",
  "timestamp": "2025-11-11T10:30:00Z",
  "health": {
    "cpuUsage": 45.2,
    "memoryUsage": 62.8,
    "diskUsage": 38.5,
    "temperature": 42.3,
    "batteryLevel": 87,
    "networkLatency": 12,
    "uptime": 86400,
    "errorCount": 0
  }
}
```

#### Command Format (Received)

```json
{
  "commandId": "cmd-uuid-123",
  "command": "SET_MODE",
  "parameters": {
    "mode": "FRUITING",
    "temperature": 18,
    "humidity": 88
  },
  "timestamp": "2025-11-11T10:30:00Z"
}
```

#### Command Response (Sent)

```json
{
  "commandId": "cmd-uuid-123",
  "status": "SUCCESS",
  "message": "Mode changed to FRUITING",
  "timestamp": "2025-11-11T10:30:05Z"
}
```

### QoS Recommendations

| Topic Type | QoS Level | Reason |
|------------|-----------|--------|
| Status updates | 1 | Ensure delivery |
| Sensor data | 0 | High frequency, minor loss acceptable |
| Commands | 2 | Critical, must not duplicate |
| Health metrics | 1 | Important but not critical |

### Example: MQTT Client (Python)

```python
import paho.mqtt.client as mqtt
import json
import time

class MASHDevice:
    def __init__(self, device_id, broker, port=1883):
        self.device_id = device_id
        self.client = mqtt.Client()
        self.client.on_connect = self.on_connect
        self.client.on_message = self.on_message
        
        # Configure broker
        self.broker = broker
        self.port = port
        
    def on_connect(self, client, userdata, flags, rc):
        print(f"Connected with result code {rc}")
        
        # Subscribe to command topic
        command_topic = f"devices/{self.device_id}/command"
        client.subscribe(command_topic, qos=2)
        
        # Subscribe to config updates
        config_topic = f"devices/{self.device_id}/config"
        client.subscribe(config_topic, qos=1)
        
        # Send online status
        self.send_status("ONLINE")
        
    def on_message(self, client, userdata, msg):
        topic = msg.topic
        payload = json.loads(msg.payload.decode())
        
        if "command" in topic:
            self.handle_command(payload)
        elif "config" in topic:
            self.handle_config_update(payload)
            
    def handle_command(self, command):
        command_id = command.get('commandId')
        cmd = command.get('command')
        params = command.get('parameters', {})
        
        print(f"Received command: {cmd} with params: {params}")
        
        # Execute command
        success = self.execute_command(cmd, params)
        
        # Send response
        response_topic = f"devices/{self.device_id}/response/{command_id}"
        response = {
            "commandId": command_id,
            "status": "SUCCESS" if success else "FAILED",
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        }
        self.client.publish(response_topic, json.dumps(response), qos=2)
        
    def execute_command(self, command, parameters):
        # Implement your command logic here
        if command == "SET_MODE":
            mode = parameters.get('mode')
            print(f"Switching to mode: {mode}")
            # Control actuators based on mode
            return True
        return False
        
    def send_status(self, status):
        topic = f"devices/{self.device_id}/status"
        payload = {
            "deviceId": self.device_id,
            "status": status,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "mode": "SPAWNING",
            "firmware": "v1.0.0"
        }
        self.client.publish(topic, json.dumps(payload), qos=1)
        
    def send_sensor_data(self, temperature, humidity, co2):
        topic = f"devices/{self.device_id}/data"
        payload = {
            "deviceId": self.device_id,
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "sensors": {
                "temperature": temperature,
                "humidity": humidity,
                "co2": co2
            }
        }
        self.client.publish(topic, json.dumps(payload), qos=0)
        
    def connect(self):
        self.client.connect(self.broker, self.port, 60)
        self.client.loop_start()
        
    def disconnect(self):
        self.send_status("OFFLINE")
        self.client.loop_stop()
        self.client.disconnect()

# Usage
device = MASHDevice("MASH-PROTO-001", "mqtt.mash.io")
device.connect()

# Send sensor data every 10 seconds
try:
    while True:
        device.send_sensor_data(22.5, 92.3, 12500)
        time.sleep(10)
except KeyboardInterrupt:
    device.disconnect()
```

---

## 🌐 WebSocket Integration

### Connection URL

```
ws://localhost:3000/socket.io
wss://mash-backend-api-production.up.railway.app/socket.io
```

### Authentication

```javascript
import io from 'socket.io-client';

const socket = io('wss://mash-backend-api-production.up.railway.app', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});
```

### Event Types

| Event | Direction | Description |
|-------|-----------|-------------|
| `device:registered` | Server → Client | New device registered |
| `device:status` | Server → Client | Device status changed |
| `device:data` | Server → Client | New sensor data |
| `device:command` | Server → Client | Command sent |
| `device:health` | Server → Client | Health update |
| `device:offline` | Server → Client | Device went offline |
| `device:online` | Server → Client | Device came online |

### Example: WebSocket Client (JavaScript)

```javascript
const socket = io('wss://mash-backend-api-production.up.railway.app', {
  auth: {
    token: process.env.ACCESS_TOKEN
  }
});

// Device status updates
socket.on('device:status', (data) => {
  console.log('Device status:', data);
  updateDashboard(data);
});

// New sensor data
socket.on('device:data', (data) => {
  console.log('Sensor data:', data);
  updateCharts(data);
});

// Device health alerts
socket.on('device:health', (data) => {
  if (data.status === 'CRITICAL') {
    showAlert(`Device ${data.deviceId} is in critical condition!`);
  }
});

// Device offline notification
socket.on('device:offline', (data) => {
  console.warn(`Device ${data.deviceId} went offline`);
  markDeviceOffline(data.deviceId);
});

// Connection events
socket.on('connect', () => {
  console.log('Connected to MASH Backend');
});

socket.on('disconnect', () => {
  console.log('Disconnected from MASH Backend');
});
```

---

## 📊 Sending Sensor Data

### Data Format Standards

- **Timestamps**: ISO 8601 format (UTC)
- **Temperature**: Celsius
- **Humidity**: Percentage (0-100)
- **CO2**: PPM (parts per million)
- **Light**: Lux

### Frequency Recommendations

| Sensor Type | Frequency | Rationale |
|-------------|-----------|-----------|
| Temperature | 30 seconds | Slow changes |
| Humidity | 30 seconds | Slow changes |
| CO2 | 60 seconds | Moderate changes |
| Light | 5 minutes | Very slow changes |
| Motion | On event | Event-driven |

### Batching Strategy

For bandwidth optimization, batch multiple readings:

```json
{
  "deviceId": "MASH-PROTO-001",
  "batch": true,
  "readings": [
    {
      "timestamp": "2025-11-11T10:30:00Z",
      "sensors": {"temperature": 22.5, "humidity": 92.3}
    },
    {
      "timestamp": "2025-11-11T10:30:30Z",
      "sensors": {"temperature": 22.6, "humidity": 92.2}
    }
  ]
}
```

### Error Handling

```python
def send_sensor_data_with_retry(data, max_retries=3):
    for attempt in range(max_retries):
        try:
            client.publish(topic, json.dumps(data), qos=1)
            return True
        except Exception as e:
            print(f"Attempt {attempt + 1} failed: {e}")
            time.sleep(2 ** attempt)  # Exponential backoff
    return False
```

---

## 🎮 Receiving Commands

### Available Commands

| Command | Parameters | Description |
|---------|------------|-------------|
| `SET_MODE` | `mode` (SPAWNING/FRUITING) | Change operation mode |
| `SET_TEMPERATURE` | `value` (number) | Set target temperature |
| `SET_HUMIDITY` | `value` (number) | Set target humidity |
| `ENABLE_ACTUATOR` | `actuator` (string), `state` (bool) | Control actuator |
| `RESTART` | None | Restart device |
| `UPDATE_CONFIG` | `config` (object) | Update configuration |
| `CALIBRATE_SENSOR` | `sensor` (string) | Calibrate sensor |

### Command Processing Flow

```
1. Receive command via MQTT
2. Validate command format
3. Check if device can execute
4. Execute command
5. Send acknowledgment
6. Report result
```

### Example: Command Handler (Arduino/ESP32)

```cpp
#include <ArduinoJson.h>
#include <PubSubClient.h>

void callback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<256> doc;
  deserializeJson(doc, payload, length);
  
  String commandId = doc["commandId"];
  String command = doc["command"];
  
  if (command == "SET_MODE") {
    String mode = doc["parameters"]["mode"];
    setOperationMode(mode);
    sendCommandResponse(commandId, "SUCCESS", "Mode changed to " + mode);
  }
  else if (command == "SET_TEMPERATURE") {
    float temp = doc["parameters"]["value"];
    setTargetTemperature(temp);
    sendCommandResponse(commandId, "SUCCESS", "Temperature set to " + String(temp));
  }
  else if (command == "ENABLE_ACTUATOR") {
    String actuator = doc["parameters"]["actuator"];
    bool state = doc["parameters"]["state"];
    controlActuator(actuator, state);
    sendCommandResponse(commandId, "SUCCESS", actuator + " " + (state ? "enabled" : "disabled"));
  }
}

void sendCommandResponse(String commandId, String status, String message) {
  StaticJsonDocument<128> doc;
  doc["commandId"] = commandId;
  doc["status"] = status;
  doc["message"] = message;
  doc["timestamp"] = getISOTimestamp();
  
  char buffer[128];
  serializeJson(doc, buffer);
  
  String topic = "devices/" + String(DEVICE_ID) + "/response/" + commandId;
  mqttClient.publish(topic.c_str(), buffer, true);
}
```

---

## 💚 Health Monitoring

### Health Metrics to Report

```json
{
  "status": "HEALTHY",        // HEALTHY, WARNING, CRITICAL, OFFLINE
  "cpuUsage": 45.2,           // Percentage
  "memoryUsage": 62.8,        // Percentage
  "diskUsage": 38.5,          // Percentage (if applicable)
  "temperature": 42.3,        // Device temperature (°C)
  "batteryLevel": 87,         // Percentage (if battery-powered)
  "networkLatency": 12,       // Milliseconds
  "uptime": 86400,            // Seconds
  "errorCount": 0,            // Number of errors since last report
  "metadata": {
    "lastReboot": "2025-11-10T12:00:00Z",
    "firmwareVersion": "v1.2.3",
    "freeMemory": 12000
  }
}
```

### Health Status Thresholds

| Metric | WARNING | CRITICAL |
|--------|---------|----------|
| CPU Usage | > 70% | > 90% |
| Memory Usage | > 80% | > 95% |
| Temperature | > 60°C | > 75°C |
| Battery Level | < 20% | < 10% |
| Error Count | > 5/hour | > 20/hour |

### Reporting Frequency

- **HEALTHY**: Every 5 minutes
- **WARNING**: Every 1 minute
- **CRITICAL**: Every 30 seconds

---

## 💻 Code Examples

### Arduino/ESP32 Complete Example

```cpp
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <DHT.h>

// Configuration
const char* ssid = "your-wifi-ssid";
const char* password = "your-wifi-password";
const char* mqtt_server = "mqtt.mash.io";
const char* device_id = "MASH-ESP32-001";

// Sensors
#define DHTPIN 4
#define DHTTYPE DHT22
DHT dht(DHTPIN, DHTTYPE);

WiFiClient espClient;
PubSubClient client(espClient);

void setup() {
  Serial.begin(115200);
  
  // Initialize WiFi
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("WiFi connected");
  
  // Initialize MQTT
  client.setServer(mqtt_server, 1883);
  client.setCallback(mqttCallback);
  
  // Initialize sensors
  dht.begin();
  
  connectMQTT();
}

void loop() {
  if (!client.connected()) {
    connectMQTT();
  }
  client.loop();
  
  // Send sensor data every 30 seconds
  static unsigned long lastSend = 0;
  if (millis() - lastSend > 30000) {
    sendSensorData();
    lastSend = millis();
  }
}

void connectMQTT() {
  while (!client.connected()) {
    Serial.print("Connecting to MQTT...");
    if (client.connect(device_id)) {
      Serial.println("connected");
      
      // Subscribe to command topic
      String commandTopic = "devices/" + String(device_id) + "/command";
      client.subscribe(commandTopic.c_str());
      
      // Send online status
      sendStatus("ONLINE");
    } else {
      Serial.print("failed, rc=");
      Serial.print(client.state());
      delay(5000);
    }
  }
}

void sendSensorData() {
  float temp = dht.readTemperature();
  float humid = dht.readHumidity();
  
  if (isnan(temp) || isnan(humid)) {
    Serial.println("Failed to read from DHT sensor!");
    return;
  }
  
  StaticJsonDocument<256> doc;
  doc["deviceId"] = device_id;
  doc["timestamp"] = getISOTimestamp();
  
  JsonObject sensors = doc.createNestedObject("sensors");
  sensors["temperature"] = temp;
  sensors["humidity"] = humid;
  
  char buffer[256];
  serializeJson(doc, buffer);
  
  String topic = "devices/" + String(device_id) + "/data";
  client.publish(topic.c_str(), buffer);
  
  Serial.println("Sensor data sent");
}

void sendStatus(String status) {
  StaticJsonDocument<128> doc;
  doc["deviceId"] = device_id;
  doc["status"] = status;
  doc["timestamp"] = getISOTimestamp();
  doc["firmware"] = "v1.0.0";
  
  char buffer[128];
  serializeJson(doc, buffer);
  
  String topic = "devices/" + String(device_id) + "/status";
  client.publish(topic.c_str(), buffer);
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  StaticJsonDocument<256> doc;
  deserializeJson(doc, payload, length);
  
  String commandId = doc["commandId"];
  String command = doc["command"];
  
  Serial.printf("Received command: %s\n", command.c_str());
  
  // Handle commands here
  if (command == "RESTART") {
    sendCommandResponse(commandId, "SUCCESS", "Restarting device");
    delay(1000);
    ESP.restart();
  }
}

void sendCommandResponse(String commandId, String status, String message) {
  StaticJsonDocument<128> doc;
  doc["commandId"] = commandId;
  doc["status"] = status;
  doc["message"] = message;
  
  char buffer[128];
  serializeJson(doc, buffer);
  
  String topic = "devices/" + String(device_id) + "/response/" + commandId;
  client.publish(topic.c_str(), buffer);
}

String getISOTimestamp() {
  // Implement NTP time sync and format as ISO 8601
  return "2025-11-11T10:30:00Z";
}
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Device Cannot Connect to MQTT

**Symptoms:**
- Connection timeouts
- Authentication failures
- No messages received

**Solutions:**
```bash
# Check network connectivity
ping mqtt.mash.io

# Verify MQTT broker is running
mosquitto_sub -h mqtt.mash.io -t test -v

# Check credentials
# Ensure username/password are correct

# Verify firewall rules
# Allow outbound connections on port 1883 (MQTT) and 8883 (MQTT/TLS)
```

#### 2. Sensor Data Not Appearing in Dashboard

**Checklist:**
- ✅ Device registered successfully?
- ✅ MQTT connection established?
- ✅ Publishing to correct topic?
- ✅ JSON format valid?
- ✅ Timestamp in ISO 8601 format?
- ✅ Device status is ONLINE?

**Debug:**
```python
# Enable MQTT logging
client.enable_logger()

# Monitor published messages
def on_publish(client, userdata, mid):
    print(f"Message {mid} published")
client.on_publish = on_publish
```

#### 3. Commands Not Received

**Check:**
- Subscribed to correct topic?
- QoS level appropriate?
- Command format matches expected schema?
- Device actually online?

**Test:**
```bash
# Manually publish test command
mosquitto_pub -h mqtt.mash.io \
  -t "devices/MASH-TEST-001/command" \
  -m '{"commandId":"test","command":"PING"}'
```

#### 4. High Latency/Delayed Updates

**Optimize:**
- Reduce message frequency
- Use QoS 0 for non-critical data
- Enable message compression
- Check network bandwidth
- Batch multiple readings

#### 5. Device Keeps Disconnecting

**Investigate:**
- WiFi signal strength
- Power supply stability
- Keep-alive timeout too short
- Memory leaks in device code
- MQTT broker connection limits

---

## 📚 Additional Resources

### API Documentation
- **Swagger UI:** https://mash-backend-api-production.up.railway.app/api/docs
- **Postman Collection:** `/postman/07-IoT-Device-Management-API.postman_collection.json`

### Protocols
- **MQTT Protocol:** `docs/iot/MQTT_PROTOCOL.md`
- **WebSocket Events:** `docs/iot/WEBSOCKET_EVENTS.md`

### Support
- **GitHub Issues:** https://github.com/MASH-Mushroom-Automation/MASH-Backend/issues
- **Email:** support@mash.com
- **Discord:** https://discord.gg/mash

---

**Last Updated:** November 11, 2025  
**Version:** 1.0.0  
**License:** MIT
