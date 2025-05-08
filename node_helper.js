'use strict';
const NodeHelper = require('node_helper');
const mqtt = require('mqtt');
const Gpio = require('onoff').Gpio;

module.exports = NodeHelper.create({
  start: function () {
    const self = this;
    console.log('[MMM-HomeAssistant] Module started!');
    this.clients = {};
    this.config = null;
  },

  connectMQTT: function () {
    if (!this.config || !this.config.mqttServer) {
      throw new Error('[MMM-HomeAssistant] MQTT server URL is missing in the configuration.');
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
    });

    this.client.on('error', (err) => {
      console.error('[MMM-HomeAssistant] MQTT connection error:', err);
    });

    this.client.on('close', () => {
      console.log('[MMM-HomeAssistant] MQTT connection closed.');
    });
  },

  initGPIO: function () {
    this.config.device.filter(device => device.gpio).forEach((device) => {
      const gpioPin = new Gpio(device.gpio, 'in', 'both');
      gpioPin.watch((err, value) => {
        if (err) {
          console.error(`[MMM-HomeAssistant] Error on GPIO pin ${device.gpio}:`, err);
          return;
        }
        console.log(`[MMM-HomeAssistant] GPIO pin ${device.gpio} value changed to:`, value);
        this.client.publish(`${this.config.deviceName}/sensor/${device.category}`, value.toString());
      });
      console.log(`[MMM-HomeAssistant] Initialized GPIO pin ${device.gpio} for ${device.category} sensor.`);
    });
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === 'MQTT_INIT') {
      this.config = payload;
      this.connectMQTT();

      if (his.config.device && this.config.device.some(device => device.gpio)) {
        this.initGPIO();
      }
    }
  },
})
