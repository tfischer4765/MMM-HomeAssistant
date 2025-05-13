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

  sendModules() {
    const modules = MM.getModules();
    const currentModuleData = [];
    modules.enumerate((module) => {
      const modData = {...module.data};
      modData.hidden = module.hidden;
      modData.lockStrings = module.lockStrings;
      modData.urlPath = module.name.replace(/MMM-/g, "").replace(/-/g, "").toLowerCase();
      modData.config = module.config;
      const modPrototype = Object.getPrototypeOf(module);
      modData.defaults = modPrototype.defaults;
      currentModuleData.push(modData);
    });
    this.sendSocketNotification("MODULES", currentModuleData);
  }

  socketNotificationReceived: function (notification, payload) {
    if (notification === "SET_BRIGHTNESS") {
      const brightness = parseInt(payload, 10);
      this.setScreenBrightness(brightness);
    }
  },

  notificationReceived: function (notification, payload, sender) {
    if (notification === "DOM_OBJECTS_CREATED") {
      this.sendSocketNotification("MQTT_INIT", this.config);
      sendModules();
    }
  },
})
