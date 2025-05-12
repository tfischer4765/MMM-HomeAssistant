Module.register("MMM-HomeAssistant", {

  defaults: {
    deviceName: "My MagicMirror",
    autodiscoveryTopic: "homeassistant",
    mqttServer: "mqtt://localhost",
    mqttPort: 1883,
  },

  start: function () {
    Log.info('Starting module: ' + this.name);
  },

  setScreenBrightness: function (value) {
    // Your logic to change screen brightness on the Pi
    console.log("Setting screen brightness to", value);
  },

  getStyles: function () {
    return ["MMM-HomeAssistant.css"]; // optional
  },

  getDom: function () {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = "MMM-HomeAssistant Module Active";
    return wrapper;
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "SET_BRIGHTNESS") {
      const brightness = parseInt(payload, 10);
      this.setScreenBrightness(brightness);
    }
  },

  notificationReceived: function (notification, payload, sender) {
    if (notification === "DOM_OBJECTS_CREATED") {
      this.sendSocketNotification("MQTT_INIT", this.config);
    }
  },
})
