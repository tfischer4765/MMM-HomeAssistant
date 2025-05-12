'use strict';
const NodeHelper = require('node_helper');
const mqtt = require('mqtt');
const si = require('systeminformation');
// const Gpio = require('onoff').Gpio;

module.exports = NodeHelper.create({
  start: function () {
    const self = this;
    console.log('[MMM-HomeAssistant] Module started!');
    this.clients = {};
    this.config = null;
    this.configTopic = null;

    // Initialize monitor and brightness values with stable defaults
    this.monitorValue = 'unknown';
    this.brightnessValue = 0;

    // Start watching endpoints
    this.watchEndpoints();
  },

  connectMQTT: function () {
    if (!this.config || !this.config.mqttServer) {
      throw new Error('[MMM-HomeAssistant] MQTT server URL is missing in the configuration.');
    }

    // Ensure the server URL includes the protocol
    if (!/^mqtt(s)?:\/\//.test(this.config.mqttServer)) {
      this.config.mqttServer = `mqtt://${this.config.mqttServer}`;
    }

    const mqttOptions = {
      clientId: this.config.deviceName || `MagicMirror_${Math.random().toString(16).substr(2, 8)}`,
      username: this.config.username || undefined,
      password: this.config.password || undefined,
      port: this.config.mqttPort || 1883, // Default MQTT port
      will: {
        topic: `${this.config.deviceName}/availability`,
        payload: 'offline',
        retain: true,
        qos: 1,
      },
    };

    // Remove undefined properties for anonymous authentication
    if (!mqttOptions.username) delete mqttOptions.username;
    if (!mqttOptions.password) delete mqttOptions.password;

    console.log('[MMM-HomeAssistant] Connecting to MQTT server:', `${this.config.mqttServer}:${mqttOptions.port}`);
    this.client = mqtt.connect(this.config.mqttServer, mqttOptions);

    this.client.on('connect', () => {
      console.log('[MMM-HomeAssistant] Successfully connected to MQTT server.');

      // Publish the MQTT device configuration
      this.publishDeviceConfig();

      // Publish initial values to the device topic as JSON
      const initialPayload = {
        state: this.monitorValue,
        brightness: this.brightnessValue,
      };
      this.client.publish(`${this.config.deviceName}`, JSON.stringify(initialPayload), { retain: true });

      // Publish birth message to availability topic
      this.client.publish(`${this.config.deviceName}/availability`, 'online', { retain: true });

      // Subscribe to /set topics
      this.subscribeToSetTopics();
    });

    this.client.on('error', (err) => {
      console.error('[MMM-HomeAssistant] MQTT connection error:', err);
    });

    this.client.on('close', () => {
      console.log('[MMM-HomeAssistant] MQTT connection closed.');

      // Publish last will message to availability topic
      this.client.publish(`${this.config.deviceName}/availability`, 'offline', { retain: true });
    });
  },

  subscribeToSetTopics: function () {
    const setTopic = `${this.config.deviceName}/set`;

    this.client.subscribe(setTopic, (err) => {
      if (err) {
        console.error('[MMM-HomeAssistant] Failed to subscribe to set topic:', err);
      } else {
        console.log('[MMM-HomeAssistant] Subscribed to set topic:', setTopic);
      }
    });

    this.client.on('message', async (topic, message) => {
      if (topic === setTopic) {
        try {
          const payload = JSON.parse(message.toString());
          console.log(`[MMM-HomeAssistant] Received message on topic ${topic}:`, payload);

          if (payload.state !== undefined) {
            await this.handleStatusSet(payload.state);
          }

          if (payload.brightness !== undefined) {
            await this.handleBrightnessSet(payload.brightness);
          }
        } catch (err) {
          console.error('[MMM-HomeAssistant] Failed to parse JSON payload:', err);
        }
      }
    });
  },

  handleStatusSet: async function (payload) {
    console.log('[MMM-HomeAssistant] Handling status set:', payload);
    if (!this.moduleAvailable) {
      console.warn('[MMM-HomeAssistant] MMM-Remote-Control module is offline. Skipping status set operation.');
      return;
    }

    try {
      const response = await fetch(`http://localhost:8080/api/monitor/${payload}`, {
        method: 'GET',
      });

      if (!response.ok) {
        console.error('[MMM-HomeAssistant] Failed to update monitor status:', response.statusText);
      } else {
        console.log('[MMM-HomeAssistant] Monitor status updated successfully.');
      }
    } catch (err) {
      console.error('[MMM-HomeAssistant] Error updating monitor status:', err);
    }
  },

  handleBrightnessSet: async function (payload) {
    console.log('[MMM-HomeAssistant] Handling brightness set:', payload);
    if (!this.moduleAvailable) {
      console.warn('[MMM-HomeAssistant] MMM-Remote-Control module is offline. Skipping brightness set operation.');
      return;
    }

    try {
      const response = await fetch(`http://localhost:8080/api/brightness/${payload}`, {
        method: 'GET',
      });

      if (!response.ok) {
        console.error('[MMM-HomeAssistant] Failed to update brightness:', response.statusText);
      } else {
        console.log('[MMM-HomeAssistant] Brightness updated successfully.');
      }
    } catch (err) {
      console.error('[MMM-HomeAssistant] Error updating brightness:', err);
    }
  },

  publishDeviceConfig: async function () {
    if (!this.configTopic) {
      this.configTopic = `${this.config.autodiscoveryTopic}/${this.config.deviceName}/config`;
    }

    try {
      // Get detailed system information
      const sys = await si.system();
      const baseboard = await si.baseboard();

      const configJson = {
        device: {
          ids: ['ea334450945afc'],
          name: this.config.deviceName,
          mf: sys.manufacturer || baseboard.manufacturer || 'unknown',
          mdl: sys.model || baseboard.model || '',
          hw: baseboard.version || 'unknown',
        },
        sw: global.version,
        status_topic: `${this.config.deviceName}/status`,
        brightness_topic: `${this.config.deviceName}/brightness`,
        command_topics: {
          status_set: `${this.config.deviceName}/status/set`,
          brightness_set: `${this.config.deviceName}/brightness/set`,
        },
      };

      console.log(configJson);

      this.client.publish(this.configTopic, JSON.stringify(configJson), { retain: true });
      console.log('[MMM-HomeAssistant] Published device configuration to:', this.configTopic);
    } catch (err) {
      console.error('[MMM-HomeAssistant] Failed to publish device configuration:', err);
    }
  },

  watchEndpoints: function () {
    const monitorUrl = 'http://localhost:8080/api/monitor';
    const brightnessUrl = 'http://localhost:8080/api/brightness';
    const availabilityUrl = 'http://localhost:8080/api/test'; // Endpoint to check module availability

    let moduleAvailable = false; // Track module availability

    const checkAvailability = async () => {
      try {
        const response = await fetch(availabilityUrl);
        moduleAvailable = response.ok;
        if (!moduleAvailable) {
          console.warn('[MMM-HomeAssistant] MMM-Remote-Control module is offline. Skipping polling.');
        }
      } catch (err) {
        moduleAvailable = false;
        console.warn('[MMM-HomeAssistant] Failed to check MMM-Remote-Control availability:', err);
      }
    };

    const fetchAndCompare = async () => {
      if (!moduleAvailable) {
        return; // Skip polling if the module is offline
      }

      try {
        // Fetch monitor data
        const monitorResponse = await fetch(monitorUrl);
        if (!monitorResponse.ok) {
          console.warn('[MMM-HomeAssistant] Monitor API not available yet. Retrying...');
          return;
        }
        const monitorData = await monitorResponse.json();

        // Fetch brightness data
        const brightnessResponse = await fetch(brightnessUrl);
        if (!brightnessResponse.ok) {
          console.warn('[MMM-HomeAssistant] Brightness API not available yet. Retrying...');
          return;
        }
        const brightnessData = await brightnessResponse.json();

        if (monitorData.monitor !== this.monitorValue || brightnessData.result !== this.brightnessValue) {
          this.monitorValue = monitorData.monitor;
          this.brightnessValue = brightnessData.result;

          const updatedPayload = {
            state: this.monitorValue,
            brightness: this.brightnessValue,
          };

          console.log('[MMM-HomeAssistant] Updated state:', updatedPayload);

          // Publish the updated state to MQTT as JSON
          if (this.client && this.client.connected) {
            this.client.publish(`${this.config.deviceName}`, JSON.stringify(updatedPayload), { retain: true });
          } else {
            console.warn('[MMM-HomeAssistant] MQTT client not connected. Updated state not published.');
          }
        }
      } catch (err) {
        console.error('[MMM-HomeAssistant] Error fetching endpoint data:', err);
      }
    };

    // Check availability every 5 seconds
    setInterval(checkAvailability, 5000);

    // Poll every 1 second
    setInterval(fetchAndCompare, 1000);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === 'MQTT_INIT') {
      this.config = payload;
      this.configTopic = `${this.config.autodiscoveryTopic}/${this.config.deviceName}/config`;
      this.connectMQTT();

      if (this.config.device && this.config.device.some(device => device.gpio)) {
        // this.initGPIO();
      }
    }
  },
});
