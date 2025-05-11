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
    });

    this.client.on('error', (err) => {
      console.error('[MMM-HomeAssistant] MQTT connection error:', err);
    });

    this.client.on('close', () => {
      console.log('[MMM-HomeAssistant] MQTT connection closed.');
    });
  },

  // initGPIO: function () {
  //   this.config.device.filter(device => device.gpio).forEach((device) => {
  //     const gpioPin = new Gpio(device.gpio, 'in', 'both');
  //     gpioPin.watch((err, value) => {
  //       if (err) {
  //         console.error(`[MMM-HomeAssistant] Error on GPIO pin ${device.gpio}:`, err);
  //         return;
  //       }
  //       console.log(`[MMM-HomeAssistant] GPIO pin ${device.gpio} value changed to:`, value);
  //       this.client.publish(`${this.config.deviceName}/sensor/${device.category}`, value.toString());
  //     });
  //     console.log(`[MMM-HomeAssistant] Initialized GPIO pin ${device.gpio} for ${device.category} sensor.`);
  //   });
  
  publishDeviceConfig: async function () {
    if (!this.configTopic) {
      this.configTopic = `${this.config.autodiscoveryTopic}/${this.config.deviceName}/config`;
    }

    try {
      // Get detailed system information
      const sys = await si.system();
      const baseboard = await si.baseboard();

      const configJson = {};
      configJson.device = {};
      configJson.device.ids = ['ea334450945afc'];
      configJson.device.name = this.config.deviceName;
      configJson.device.mf = sys.manufacturer || baseboard.manufacturer || 'unknown';
      configJson.device.mdl = sys.model || baseboard.model || '';
      configJson.device.hw = baseboard.version || 'unknown';
      configJson.device.sw = global.version;

      console.log(configJson);

      this.client.publish(this.configTopic, JSON.stringify(configJson), { retain: true });
      console.log('[MMM-HomeAssistant] Published device configuration to:', this.configTopic);
    } catch (err) {
      console.error('[MMM-HomeAssistant] Failed to publish device configuration:', err);
    }
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
})
