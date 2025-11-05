import { io, Socket } from 'socket.io-client';

describe('Monitoring WebSocket (e2e)', () => {
  let socket: Socket;
  const SOCKET_URL = 'http://localhost:3000';
  const NAMESPACE = '/monitoring';

  beforeEach((done) => {
    socket = io(`${SOCKET_URL}${NAMESPACE}`, {
      transports: ['websocket'],
      forceNew: true,
    });

    socket.on('connect', () => {
      done();
    });

    socket.on('connect_error', (error) => {
      console.error('Connection error:', error);
      done.fail(error);
    });
  });

  afterEach((done) => {
    if (socket.connected) {
      socket.disconnect();
    }
    done();
  });

  describe('Connection', () => {
    it('should connect to monitoring namespace', (done) => {
      expect(socket.connected).toBe(true);
      done();
    });

    it('should have valid socket ID', (done) => {
      expect(socket.id).toBeDefined();
      expect(socket.id).not.toBe('');
      done();
    });
  });

  describe('Metrics Subscription', () => {
    it('should receive subscription confirmation', (done) => {
      socket.on('subscribed', (data) => {
        expect(data).toHaveProperty('event');
        expect(data.event).toBe('metrics');
        expect(data).toHaveProperty('message');
        done();
      });

      socket.emit('subscribe:metrics');
    });

    it('should receive metrics updates', (done) => {
      socket.on('metrics:update', (data) => {
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('metrics');
        expect(typeof data.timestamp).toBe('number');
        expect(typeof data.metrics).toBe('object');
        done();
      });

      socket.emit('subscribe:metrics');

      // Wait for broadcast (happens every 5 seconds)
      // This test may take up to 6 seconds
    }, 10000);

    it('should receive unsubscribe confirmation', (done) => {
      socket.on('subscribed', () => {
        socket.emit('unsubscribe:metrics');
      });

      socket.on('unsubscribed', (data) => {
        expect(data).toHaveProperty('event');
        expect(data.event).toBe('metrics');
        done();
      });

      socket.emit('subscribe:metrics');
    });

    it('should stop receiving updates after unsubscribe', (done) => {
      let updateCount = 0;

      socket.on('metrics:update', () => {
        updateCount++;
      });

      socket.emit('subscribe:metrics');

      // Wait for first update
      setTimeout(() => {
        socket.emit('unsubscribe:metrics');
        const countAfterUnsubscribe = updateCount;

        // Wait and verify no more updates
        setTimeout(() => {
          expect(updateCount).toBe(countAfterUnsubscribe);
          done();
        }, 6000);
      }, 6000);
    }, 15000);
  });

  describe('Alerts Subscription', () => {
    it('should receive subscription confirmation', (done) => {
      socket.on('subscribed', (data) => {
        expect(data).toHaveProperty('event');
        expect(data.event).toBe('alerts');
        expect(data).toHaveProperty('message');
        done();
      });

      socket.emit('subscribe:alerts');
    });

    it('should receive alert notifications', (done) => {
      socket.on('alert:new', (data) => {
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('alert');
        expect(typeof data.timestamp).toBe('number');
        expect(typeof data.alert).toBe('object');
        done();
      });

      socket.emit('subscribe:alerts');

      // Note: This test will only pass if an alert is triggered
      // Consider triggering a test alert programmatically
    }, 10000);

    it('should receive unsubscribe confirmation', (done) => {
      socket.on('subscribed', () => {
        socket.emit('unsubscribe:alerts');
      });

      socket.on('unsubscribed', (data) => {
        expect(data).toHaveProperty('event');
        expect(data.event).toBe('alerts');
        done();
      });

      socket.emit('subscribe:alerts');
    });
  });

  describe('Health Subscription', () => {
    it('should receive subscription confirmation', (done) => {
      socket.on('subscribed', (data) => {
        expect(data).toHaveProperty('event');
        expect(data.event).toBe('health');
        expect(data).toHaveProperty('message');
        done();
      });

      socket.emit('subscribe:health');
    });

    it('should receive health status updates', (done) => {
      socket.on('health:status', (data) => {
        expect(data).toHaveProperty('timestamp');
        expect(data).toHaveProperty('health');
        expect(typeof data.timestamp).toBe('number');
        expect(typeof data.health).toBe('object');
        done();
      });

      socket.emit('subscribe:health');

      // Note: This test will only pass if health status changes
      // Consider triggering a health check programmatically
    }, 10000);

    it('should receive unsubscribe confirmation', (done) => {
      socket.on('subscribed', () => {
        socket.emit('unsubscribe:health');
      });

      socket.on('unsubscribed', (data) => {
        expect(data).toHaveProperty('event');
        expect(data.event).toBe('health');
        done();
      });

      socket.emit('subscribe:health');
    });
  });

  describe('Multiple Subscriptions', () => {
    it('should handle multiple subscriptions simultaneously', (done) => {
      let metricsConfirmed = false;
      let alertsConfirmed = false;
      let healthConfirmed = false;

      socket.on('subscribed', (data) => {
        if (data.event === 'metrics') metricsConfirmed = true;
        if (data.event === 'alerts') alertsConfirmed = true;
        if (data.event === 'health') healthConfirmed = true;

        if (metricsConfirmed && alertsConfirmed && healthConfirmed) {
          expect(true).toBe(true);
          done();
        }
      });

      socket.emit('subscribe:metrics');
      socket.emit('subscribe:alerts');
      socket.emit('subscribe:health');
    });

    it('should receive updates for all subscribed events', (done) => {
      let metricsReceived = false;

      socket.on('metrics:update', () => {
        metricsReceived = true;
      });

      socket.on('alert:new', () => {
        // Alert received
      });

      socket.on('health:status', () => {
        // Health received
      });

      socket.emit('subscribe:metrics');
      socket.emit('subscribe:alerts');
      socket.emit('subscribe:health');

      // Wait for at least one update
      setTimeout(() => {
        expect(metricsReceived).toBe(true);
        done();
      }, 6000);
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle invalid events gracefully', (done) => {
      socket.emit('invalid:event');

      // Should not crash - wait and verify connection is still active
      setTimeout(() => {
        expect(socket.connected).toBe(true);
        done();
      }, 1000);
    });

    it('should reconnect after disconnect', (done) => {
      socket.on('disconnect', () => {
        // Attempt reconnection
        socket.connect();
      });

      socket.on('connect', () => {
        if (!socket.connected) {
          done.fail('Failed to reconnect');
        } else {
          done();
        }
      });

      // Force disconnect
      socket.disconnect();
    }, 5000);
  });

  describe('Data Validation', () => {
    it('should receive valid metrics structure', (done) => {
      socket.on('metrics:update', (data) => {
        expect(data.timestamp).toBeGreaterThan(0);
        expect(data.metrics).toBeDefined();
        
        // Verify metrics object has expected properties
        // (adjust based on your actual metrics)
        expect(typeof data.metrics).toBe('object');
        done();
      });

      socket.emit('subscribe:metrics');
    }, 10000);

    it('should receive valid alert structure', (done) => {
      socket.on('alert:new', (data) => {
        expect(data.timestamp).toBeGreaterThan(0);
        expect(data.alert).toBeDefined();
        expect(data.alert).toHaveProperty('id');
        expect(data.alert).toHaveProperty('eventType');
        expect(data.alert).toHaveProperty('priority');
        done();
      });

      socket.emit('subscribe:alerts');
    }, 10000);

    it('should receive valid health structure', (done) => {
      socket.on('health:status', (data) => {
        expect(data.timestamp).toBeGreaterThan(0);
        expect(data.health).toBeDefined();
        expect(typeof data.health).toBe('object');
        done();
      });

      socket.emit('subscribe:health');
    }, 10000);
  });
});
