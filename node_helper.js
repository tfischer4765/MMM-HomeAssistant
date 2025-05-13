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
    this.modules = null;

    this.stateTopic = null;
    this.setTopic = null;
    this.availabilityTopic = null;

    this.monitorValue = 'unknown';
    this.brightnessValue = 0;
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
        topic: this.availabilityTopic,
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

      // Publish initial values to the device topic as JSON
      const initialPayload = {
        state: this.monitorValue,
        brightness: this.brightnessValue,
      };
      this.client.publish(this.stateTopic, JSON.stringify(initialPayload), { retain: true });

      // Publish birth message to availability topic
      this.client.publish(this.availabilityTopic, 'online', { retain: true });

      // Subscribe to /set topics
      this.subscribeToSetTopics();
    });

    this.client.on('error', (err) => {
      console.error('[MMM-HomeAssistant] MQTT connection error:', err);
    });

    this.client.on('close', () => {
      console.log('[MMM-HomeAssistant] MQTT connection closed.');

      // Publish last will message to availability topic
      this.client.publish(this.availabilityTopic, 'offline', { retain: true });
    });
  },

  subscribeToSetTopics: function () {
    this.client.subscribe(this.setTopic, (err) => {
      if (err) {
        console.error('[MMM-HomeAssistant] Failed to subscribe to set topic:', err);
      } else {
        console.log('[MMM-HomeAssistant] Subscribed to set topic:', this.setTopic);
      }
    });

    this.client.on('message', async (topic, message) => {
      if (topic === this.setTopic) {
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
    try {
      const response = await fetch(`http://localhost:8080/api/monitor/${payload}`, {
        method: 'GET',
      });

      if (!response.ok) {
        console.error('[MMM-HomeAssistant] Failed to update monitor status:', response.statusText);
        return;
      }

      const responseData = await response.json();
      if (!responseData.success) {
        console.error('[MMM-HomeAssistant] Monitor status update failed. Success flag is false:', responseData);
        return;
      }

      console.log('[MMM-HomeAssistant] Monitor status updated successfully.');
    } catch (err) {
      console.error('[MMM-HomeAssistant] Error updating monitor status:', err);
    }
  },

  handleBrightnessSet: async function (payload) {
    console.log('[MMM-HomeAssistant] Handling brightness set:', payload);
    try {
      const response = await fetch(`http://localhost:8080/api/brightness/${payload}`, {
        method: 'GET',
      });

      if (!response.ok) {
        console.error('[MMM-HomeAssistant] Failed to update brightness:', response.statusText);
        return;
      }

      const responseData = await response.json();
      if (!responseData.success) {
        console.error('[MMM-HomeAssistant] Brightness update failed. Success flag is false:', responseData);
        return;
      }

      console.log('[MMM-HomeAssistant] Brightness updated successfully.');
    } catch (err) {
      console.error('[MMM-HomeAssistant] Error updating brightness:', err);
    }
  },

  publishConfigs: async function () {
    try {
      const deviceId = this.config.deviceName.replace(/\s+/g, '_').toLowerCase();
      const sys = await si.system();
      const baseboard = await si.baseboard();

      const deviceJson = {
        device: {
          ids: ['ea334450945afc'],
          name: this.config.deviceName,
          mf: sys.manufacturer || baseboard.manufacturer || 'unknown',
          mdl: sys.model || baseboard.model || '',
          hw: baseboard.version || 'unknown',
          sw: global.version,
        },
      };

      const topics = [];
      const payloads = [];

      const lightJson = {
        availability_topic: this.availabilityTopic,
        command_topic: this.setTopic,
        brightness: true,
        brightness_scale: 100,
        name: this.config.deviceName,
        object_id: deviceId,
        schema: "json",
        state_topic: this.stateTopic,
        unique_id: deviceId,
      };

      modules.forEach(element => {
        const switchJson = {
          
        }
      });

      // Publish light configuration to MQTT autodiscovery topic
      const lightConfigTopic = `${this.config.autodiscoveryTopic}/light/${deviceId}/display/config`;

      const combinedJson = { ...deviceJson, ...lightJson };
      this.client.publish(lightConfigTopic, JSON.stringify(combinedJson), { retain: true });

      console.log('[MMM-HomeAssistant] Published light config to:', lightConfigTopic);
    } catch (err) {
      console.error('[MMM-HomeAssistant] Failed to publish light configuration:', err);
    }
  },

  watchEndpoints: function () {
    const monitorUrl = 'http://localhost:8080/api/monitor';
    const brightnessUrl = 'http://localhost:8080/api/brightness';

    const fetchAndCompare = async () => {

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
            state: this.monitorValue.toUpperCase(),
            brightness: this.brightnessValue,
          };

          console.log('[MMM-HomeAssistant] Updated state:', updatedPayload);

          // Publish the updated state to MQTT as JSON
          if (this.client && this.client.connected) {
            this.client.publish(this.stateTopic, JSON.stringify(updatedPayload), { retain: true });
          } else {
            console.warn('[MMM-HomeAssistant] MQTT client not connected. Updated state not published.');
          }
        }
      } catch (err) {
        console.error('[MMM-HomeAssistant] Error fetching endpoint data:', err);
      }
    };

    // Poll every 1 second
    setInterval(fetchAndCompare, 1000);
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === 'MQTT_INIT') {
      this.config = payload;
      this.stateTopic = this.config.deviceName;
      this.setTopic = `${this.config.deviceName}/set`;
      this.availabilityTopic = `${this.config.deviceName}/availability`;
      this.watchEndpoints();
      this.connectMQTT();

      if (this.config.device && this.config.device.some(device => device.gpio)) {
        // this.initGPIO();
      }
    }

    if (notification === 'MODULES') {
      this.modules = payload;
      console.log('[MMM-HomeAssistant] Received modules data:', this.modules);
      this.publishConfigs();
    }
  },
});
