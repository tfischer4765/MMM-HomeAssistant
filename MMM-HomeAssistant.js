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

  getStyles: function () {
    return ["MMM-HomeAssistant.css"]; // optional
  },

  getDom: function () {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = "MMM-HomeAssistant Module Active";
    return wrapper;
  },

  sendModules() {
    const modules = MM.getModules().exceptModule(this).exceptWithClass("MMM-Remote-Control");
    const currentModuleData = [];
    modules.enumerate((module) => {
      const entry = {};
      entry.hidden = !module.hidden ? 'ON' : 'OFF';
      entry.name = module.name.replace(/MMM-/g, "").replace(/-/g, "");
      entry.urlPath = entry.name.toLowerCase();
      currentModuleData.push(entry);
    });
    this.sendSocketNotification("MODULES", currentModuleData);
  },

  notificationReceived: function (notification, payload, sender) {
    if (notification === "DOM_OBJECTS_CREATED") {
      if (this.config.moduleControl === true) {
        this.sendModules();
      }
      this.sendSocketNotification("MQTT_INIT", this.config);
      
    }
  },
})
