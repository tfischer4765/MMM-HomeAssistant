'use strict';
const NodeHelper = require('node_helper');
const mqtt = require('mqtt');
const Gpio = require('onoff').Gpio;

module.exports = NodeHelper.create({
  start: function () {
    const self = this;
    console.log('[MMM-MQTT-HA] Module started');
    this.clients = {};
    this.config = null;
  },

  connectMQTT: function () {
    const { mqttServer, mqttUsername, mqttPassword, brightnessTopic } = this.config;
    this.client = mqtt.connect(mqttServer, {
      username: mqttUsername,
      password: mqttPassword
    });

    this.client.on('connect', () => {
      console.log('[MMM-MQTT-HA] Connected to MQTT');
      this.client.subscribe(brightnessTopic);
    });

    this.client.on('message', (topic, message) => {
      if (topic === brightnessTopic) {
        this.sendSocketNotification('SET_BRIGHTNESS', message.toString());
      }
    });
  },

  initGPIO: function () {
    const { pirPin, lightSensorPin, pirTopic, lightSensorTopic } = this.config;
    this.pirSensor = new Gpio(pirPin, 'in', 'both');
    this.lightSensor = new Gpio(lightSensorPin, 'in', 'both');

    this.pirSensor.watch((err, value) => {
      if (err) console.error('[MMM-MQTT-HA] PIR sensor error:', err);
      this.client.publish(pirTopic, value.toString());
    });

    this.lightSensor.watch((err, value) => {
      if (err) console.error('[MMM-MQTT-HA] Light sensor error:', err);
      this.client.publish(lightSensorTopic, value.toString());
    });
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === 'MQTT_INIT') {
      this.config = payload;
      this.connectMQTT();
      this.initGPIO();
    }
  },
})
