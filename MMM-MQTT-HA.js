Module.register("MMM-MQTT-HA", {

  defaults: {
    exampleContent: ""
  },

  start: function () {
    this.sendSocketNotification("MQTT_INIT", this.config);
  },

  setScreenBrightness: function (value) {
    // Your logic to change screen brightness on the Pi
    console.log("Setting screen brightness to", value);
  },

  getStyles: function () {
    return ["MMM-MQTT-HA.css"]; // optional
  },

  getDom: function () {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = "MQTT-HA Module Active";
    return wrapper;
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "SET_BRIGHTNESS") {
      const brightness = parseInt(payload, 10);
      this.setScreenBrightness(brightness);
    }
  },
})
