'use strict';
const NodeHelper = require('node_helper');
const mqtt = require('mqtt');
const si = require('systeminformation');
const { exec } = require('child_process');
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

    const nsp = this.io.of('/MMM-HomeAssistant');
    nsp.on('connection', (socket) => {
      console.log('[MMM-HomeAssistant] Socket connected:', socket.id);
      this.clients[socket.id] = true;

      socket.on('disconnect', () => {
        console.log('[MMM-HomeAssistant] Socket disconnected:', socket.id);
        delete this.clients[socket.id];
        if (Object.keys(this.clients).length === 0) {
          // No clients connected, disconnect from MQTT
          if (this.client) {
            console.log('[MMM-HomeAssistant] No clients connected, disconnecting from MQTT.');
            this.client.end();
            this.client = null;
          }
        }
      });
    });
  },

  connectMQTT: function () {
    if (this.client) return;

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

      this.mqttErrorLogged = false; // Reset error flag on successful connect
      this.mqttCloseLogged = false; // Reset close flag on successful connect

      this.publishConfigs();

      // Publish birth message to availability topic
      this.client.publish(this.availabilityTopic, 'online', { retain: true });

      // Subscribe to /set topics
      this.subscribeToSetTopics();
    });

    this.client.on('error', (err) => {
      if (!this.mqttErrorLogged) {
        console.error('[MMM-HomeAssistant] MQTT connection error:', err);
        this.mqttErrorLogged = true; // Set error flag to prevent repeated logging
      }
    });

    this.client.on('close', () => {
      if (!this.mqttCloseLogged) {
        console.log('[MMM-HomeAssistant] MQTT connection closed.');
        this.mqttCloseLogged = true; // Set close flag to prevent repeated logging
        // Publish last will message to availability topic
        this.client.publish(this.availabilityTopic, 'offline', { retain: true });
      }
    });
  },

  subscribeToSetTopics: function () {
    const topics = [this.setTopic];
    if (this.config.pm2ProcessName) {
      topics.push(`${this.setTopic}/restart`);
    }
    this.client.subscribe(topics, (err, granted) => {
      if (err) {
        console.error('[MMM-HomeAssistant] Failed to subscribe to set topics:', err);
      } else {
        console.log('[MMM-HomeAssistant] Subscribed to set topics:', granted.map(g => g.topic).join(', '));
      }
    });

    this.client.on('message', async (topic, message) => {
      if (topic === this.setTopic) {
        try {
          const payload = JSON.parse(message.toString());
          console.log(`[MMM-HomeAssistant] Received message on topic ${topic}:`, payload);

          if ((this.config.brightnessControl || this.config.monitorControl) &&
            payload.state !== undefined && payload.state !== this.monitorValue) {
            await this.handleMonitorSet(payload.state);
          }

          if (this.config.brightnessControl &&
            payload.brightness !== undefined && payload.state !== this.brightnessValue) {
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

      if (topic === `${this.setTopic}/restart`) {
        console.log('[MMM-HomeAssistant] Restart command received.');
        this.handleRestart();
      }
    });
  },

  handleMonitorSet: async function (payload) {
    console.log('[MMM-HomeAssistant] Handling monitor set:', payload);

    let command;
    if (payload === 'ON') {
      command = this.config.monitorOnCommand;
    } else if (payload === 'OFF') {
      command = this.config.monitorOffCommand;
    } else {
      console.error('[MMM-HomeAssistant] Invalid monitor state payload:', payload);
      return;
    }

    if (!command) {
      console.error('[MMM-HomeAssistant] Monitor command not configured for state:', payload);
      return;
    }

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`[MMM-HomeAssistant] Error executing monitor command:`, error);
        return;
      }
      this.monitorValue = payload;
      this.publishStates();
    });
  },

  handleBrightnessSet: async function (payload) {
    console.log('[MMM-HomeAssistant] Handling brightness set:', payload);
    this.sendSocketNotification("BRIGHTNESS_CONTROL", payload);
  },

  handleModuleSet: async function (moduleName, payload) {
    console.log(`[MMM-HomeAssistant] Handling module set for ${moduleName}:`, payload);
    const module = this.modules.find(m => m.urlPath === moduleName);
    const command = payload[moduleName];
    const identifier = module.identifier;
    this.sendSocketNotification("MODULE_CONTROL", { identifier, command });

  },

  handleRestart: function () {
    console.log('[MMM-HomeAssistant] Handling PM2 restart action');
    let pm2;
    try {
      pm2 = require('pm2');
    } catch (err) {
      console.log('[MMM-HomeAssistant] PM2 not installed or unlinked');
      return;
    }
    pm2.connect((err) => {
      if (err) {
        console.error('[MMM-HomeAssistant] PM2 connect error:', err);
        return;
      }
      console.log(`[MMM-HomeAssistant] Restarting PM2 process: ${this.config.pm2ProcessName}`);
      pm2.restart(this.config.pm2ProcessName, (err) => {
        if (err) {
          console.error('[MMM-HomeAssistant] PM2 restart error:', err);
        } else {
          console.log(`[MMM-HomeAssistant] PM2 process ${this.config.pm2ProcessName} restarted successfully.`);
        }
        pm2.disconnect();
      });
    });
  },

  publishConfigs: async function () {
    try {
      const deviceId = this.config.deviceName
        .normalize('NFD') // decompose accented chars
        .replace(/[\u0300-\u036f]/g, '') // remove accents
        .replace(/\W+/g, '_') // replace non-word chars with _
        .replace(/^_+|_+$/g, '') // trim leading/trailing _
        .toLowerCase();
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
          state_topic: this.stateTopic,
          command_topic: this.setTopic,
          brightness: this.config.brightnessControl,
          brightness_scale: 100,
          schema: "json",
          value_template: "{{ value_json.state }}",
          name: null,
          object_id: `${deviceId}_light`,
          unique_id: `${deviceId}_light`,
        };

        // Publish light configuration to MQTT autodiscovery topic
        const lightConfigTopic = `${this.config.autodiscoveryTopic}/light/${deviceId}/config`;
        const combinedJson = { ...deviceJson, ...lightJson };

        topics.push(lightConfigTopic);
        payloads.push(JSON.stringify(combinedJson));
      }

      if (this.config.moduleControl) {
        this.modules.forEach(element => {
          const switchJson = {
            availability_topic: this.availabilityTopic,
            state_topic: this.stateTopic,
            command_topic: this.setTopic,
            entity_category: "config",
            schema: "json",
            value_template: `{{ value_json.${element.urlPath} }}`,
            command_template: `{"${element.urlPath}": "{{ value }}" }`,
            name: element.name.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()),
            object_id: `${deviceId}_${element.urlPath}_switch`,
            unique_id: `${deviceId}_${element.urlPath}_switch`,
          }
          topics.push(`${this.config.autodiscoveryTopic}/switch/${deviceId}/${element.urlPath}/config`);
          payloads.push(JSON.stringify({ ...deviceJson, ...switchJson }));
        });
      }

      if (this.config.pm2ProcessName) {
        const restartButtonJson = {
          availability_topic: this.availabilityTopic,
          command_topic: `${this.setTopic}/restart`,
          device_class: "restart",
          payload_press: "identify",
          entity_category: "diagnostic",
          name: 'Restart',
          object_id: `${deviceId}_restart`,
          unique_id: `${deviceId}_restart`,
        };

        // Publish light configuration to MQTT autodiscovery topic
        const restartConfigTopic = `${this.config.autodiscoveryTopic}/button/${deviceId}/restart/config`;
        const combinedJson = { ...deviceJson, ...restartButtonJson };

        topics.push(restartConfigTopic);
        payloads.push(JSON.stringify(combinedJson));
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
        payload[element.urlPath] = element.hidden ? 'OFF' : 'ON';
      });
    }

    if (Object.keys(payload).length > 0) {
      console.log('[MMM-HomeAssistant] Updated state:', payload);
      this.client.publish(this.stateTopic, JSON.stringify(payload), { retain: true });
    }
  },

  watchEndpoints: function () {
    if (this.config.monitorStatusCommand) {

      const pollMonitorStatus = () => {
        exec(this.config.monitorStatusCommand, (error, stdout, stderr) => {
          if (error) {
            console.error(`[MMM-HomeAssistant] Error executing monitorStatusCommand:`, error);
            return;
          }
          const trimmed = stdout.trim().toLowerCase();
          // Interpret "true" as ON, "false" as OFF
          const newValue = (trimmed === 'true' || trimmed === '1') ? 'ON' : 'OFF';
          if (newValue !== this.monitorValue) {
            this.monitorValue = newValue;
            this.publishStates();
          }
        });
      };

      pollMonitorStatus();
      setInterval(pollMonitorStatus, 2000);
    }
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

    if (notification === 'MODULES_UPDATE') {
      const wasEmpty = !Array.isArray(this.modules) || this.modules.length === 0;
      this.modules = payload;
      if (wasEmpty) {
        console.log('[MMM-HomeAssistant] Received modules data:', this.modules);
      }
      else {
        this.publishStates();
      }
    }

    if (notification === 'BRIGHTNESS_UPDATE') {
      const newBrightness = Math.max(0, Math.min(100, payload));
      if (newBrightness !== this.brightnessValue) {
        this.brightnessValue = newBrightness;
        this.publishStates();
      }
    }
  },
});
