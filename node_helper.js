'use strict';
const NodeHelper = require('node_helper');
const mqtt = require('mqtt');
const si = require('systeminformation');
// const Gpio = require('onoff').Gpio;

module.exports = NodeHelper.create({
  start: function () {
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

      this.publishStates()

      // Publish birth message to availability topic
      this.client.publish(this.availabilityTopic, 'online', { retain: true });

      // Subscribe to /set topics
      this.subscribeToSetTopic();
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

  subscribeToSetTopic: function () {
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

          if ((this.config.brightnessControl || this.config.monitorControl) &&
            payload.state !== undefined) {
            await this.handleStatusSet(payload.state);
          }

          if (this.config.brightnessControl && payload.brightness !== undefined) {
            await this.handleBrightnessSet(payload.brightness);
          }

          if (this.config.moduleControl) {
            if (Array.isArray(this.modules)) {
              this.modules.forEach((element) => {
                if (payload.hasOwnProperty(element.urlPath)) {
                  this.handleModuleSet(element.urlPath, payload);
                }
              });
            } else {
              console.error('[MMM-HomeAssistant] this.modules is not an array:', this.modules);
            }
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

  handleModuleSet: async function (moduleName, payload) {
    console.log(`[MMM-HomeAssistant] Handling module set for ${moduleName}:`, payload);
    try {
      const response = await fetch(`http://localhost:8080/api/module/${moduleName}/${payload}`, {
        method: 'GET',
      });

      if (!response.ok) {
        console.error(`[MMM-HomeAssistant] Failed to set module ${moduleName}:`, response.statusText);
        return;
      }

      const responseData = await response.json();
      if (!responseData.success) {
        console.error(`[MMM-HomeAssistant] Module set operation failed for ${moduleName}. Success flag is false:`, responseData);
        return;
      }

      console.log(`[MMM-HomeAssistant] Module ${moduleName} set operation completed successfully.`);
    } catch (err) {
      console.error(`[MMM-HomeAssistant] Error setting module ${moduleName}:`, err);
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

      // Light entity is added if monitorControl or brightnessControl is enabled
      if (this.config.monitorControl || this.config.brightnessControl) {
        const lightJson = {
          availability_topic: this.availabilityTopic,
          command_topic: this.setTopic,
          brightness: this.config.brightnessControl,
          brightness_scale: 100,
          name: this.config.deviceName,
          object_id: deviceId,
          schema: "json",
          state_topic: this.stateTopic,
          unique_id: deviceId,
        };

        // Publish light configuration to MQTT autodiscovery topic
        const lightConfigTopic = `${this.config.autodiscoveryTopic}/light/${deviceId}/display/config`;
        const combinedJson = { ...deviceJson, ...lightJson };

        topics.push(lightConfigTopic);
        payloads.push(JSON.stringify(combinedJson));
      }

      if (this.config.moduleControl) {
        modules.forEach(element => {
          const switchJson = {
            schema: "json",
            value_template: "{{ value_json.${element.urlPath} }}",
            name: null,
            object_id: element.urlPath,
            command_topic: this.setTopic,
          }
          topics.push(`${this.config.autodiscoveryTopic}/switch/${deviceId}/${element.urlPath}/config`);
          payloads.push(JSON.stringify({ ...deviceJson, ...switchJson }));
        });
      }


      topics.forEach((topic, index) => {
        const payload = payloads[index];
        this.client.publish(topic, payload, { retain: true });
        console.log('[MMM-HomeAssistant] Published config to:', topic);
      });

    } catch (err) {
      console.error('[MMM-HomeAssistant] Failed to publish light configuration:', err);
    }
  },

  publishStates: function () {
    // Publish initial values to the device topic as JSON
    const payload = {};
    if (this.config.brightnessControl || this.config.monitorControl) {
      payload.state = this.monitorValue;
    }
    if (this.config.brightnessControl) {
      payload.brightness = this.brightnessValue;
    }
    if (this.config.moduleControl) {
      this.modules.forEach(element => {
        payload[element.urlPath] = element.hidden;
      });
    }
    console.log('[MMM-HomeAssistant] Updated state:', payload);
    this.client.publish(this.stateTopic, JSON.stringify(payload), { retain: true });
  },

  watchEndpoints: function () {
    const fetchData = async (url, elementKey) => {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.warn(`[MMM-HomeAssistant] API not available yet for ${url}. Retrying...`);
          return null;
        }
        const data = await response.json();
        if (!data.success) {
          console.error(`[MMM-HomeAssistant] API call to ${url} failed. Success flag is false:`, data);
          return null;
        }
        return data[elementKey];
      } catch (err) {
        console.error(`[MMM-HomeAssistant] Error fetching data from ${url}:`, err);
        return null;
      }
    };

    const fetchDisplayData = async () => {
      let publishNeeded = false; // Flag to determine if states need to be published

      const monitorData = await fetchData('http://localhost:8080/api/monitor', 'monitor');
      const brightnessData = await fetchData('http://localhost:8080/api/brightness', 'result');

      if (monitorData && brightnessData) {
        if (monitorData.toUpperCase() !== this.monitorValue || brightnessData !== this.brightnessValue) {
          this.monitorValue = monitorData.toUpperCase();
          this.brightnessValue = brightnessData;
          publishNeeded = true; // Set flag if monitor or brightness values change
        }
      }

      if (Array.isArray(this.modules)) {
        for (let i = 0; i < this.modules.length; i++) {
          const data = await fetchData(`http://localhost:8080/api/module/${this.modules[i].urlPath}`, 'data');

          if (data !== null) {
            const hiddenData = data.hidden ? 'ON' : 'OFF';
            if (hiddenData !== this.modules[i].hidden) {
              this.moduleValues[i] = hiddenData; // Update module value
              publishNeeded = true; // Set flag if module value changes
            }
          } else {
            console.warn(`[MMM-HomeAssistant] No data returned for module ${this.modules[i].urlPath}`);
          }
        }
      } else {
        console.error('[MMM-HomeAssistant] this.modules is not an array:', this.modules);
      }

      if (publishNeeded) {
        this.publishStates(); // Publish states if any value has changed
      }
    };

    // Poll every 1 second
    setInterval(fetchDisplayData, 1000);
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
    }
  },
});
