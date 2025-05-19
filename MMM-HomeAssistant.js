Module.register("MMM-HomeAssistant", {

  defaults: {
    deviceName: "My MagicMirror",
    autodiscoveryTopic: "homeassistant",
    mqttServer: "mqtt://localhost",
    pm2ProcessName: "mm",
    mqttPort: 1883,
  },

  start: function () {
    Log.info('Starting module: ' + this.name);
    this.modules = [];
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
    // Handling multiple instances of the same module
    const baseNameCounts = {};
    this.modules.enumerate((module) => {
      const baseName = module.name.replace(/MMM-/g, "").replace(/-/g, "");
      baseNameCounts[baseName] = (baseNameCounts[baseName] || 0) + 1;
    });
    const nameInstance = {};
    const currentModuleData = [];
    this.modules.enumerate((module) => {
      const baseName = module.name.replace(/MMM-/g, "").replace(/-/g, "");
      nameInstance[baseName] = (nameInstance[baseName] || 0) + 1;
      let name = baseName;
      if (baseNameCounts[baseName] > 1) {
        name = `${baseName}_${nameInstance[baseName]}`;
      }
      const entry = {};
      entry.identifier = module.identifier;
      entry.hidden = module.hidden;
      entry.name = name;
      entry.urlPath = name.toLowerCase().replace(/\s+/g, "_");
      currentModuleData.push(entry);
    });
    this.sendSocketNotification("MODULES_UPDATE", currentModuleData);
  },

  monitorModulesHiddenState() {
    this.modules.enumerate((module) => {
      const div = document.getElementById(module.identifier);
      if (!div) return;
      let lastHidden = module.hidden;
      const observer = new MutationObserver(() => {
        if (module.hidden !== lastHidden) {
          lastHidden = module.hidden;
          Log.info(`[MMM-HomeAssistant] Module '${module.identifier}' hidden state changed to: ${lastHidden}`);
          this.sendModules();
        }
      });
      observer.observe(div, { attributes: true, attributeFilter: ['class'] });
    });
  },

  socketNotificationReceived(notification, payload) {
    if (notification === "MODULE_CONTROL") {
      Log.info(`[MMM-HomeAssistant] Module control received: ${payload.identifier} ${payload.command}`);
      const module = this.modules.find(m => m.identifier === payload.identifier);
      if (payload.command === 'ON')
        module.show(1000, function () { }, { lockString: payload.moduleName });
      else if (payload.command === 'OFF')
        module.hide(1000, function () { }, { lockString: payload.moduleName })
    }
  },

  notificationReceived: function (notification, payload, sender) {
    if (notification === "DOM_OBJECTS_CREATED") {
      if (this.config.moduleControl === true) {
        this.modules = MM.getModules()
          .exceptModule(this)
          .exceptWithClass("MMM-Remote-Control")
          .exceptWithClass("alert");
        this.sendModules();
      }
      this.sendSocketNotification("MQTT_INIT", this.config);
      this.monitorOverlayBrightness();
      if (this.config.moduleControl === true) {
        this.monitorModulesHiddenState();
      }
    }
  },

  monitorOverlayBrightness: function () {
    const getOverlay = () => document.getElementById('remote-control-overlay-temp');
    const getBrightness = (overlay) => {
      if (!overlay) return 100;
      const filter = overlay.style.filter;
      if (!filter) return 100;
      const match = filter.match(/brightness\((\d+)%?\)/i);
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
      // If filter is like 'brightness(0.6)'
      const floatMatch = filter.match(/brightness\((0?\.\d+)\)/i);
      if (floatMatch && floatMatch[1]) {
        return Math.round(parseFloat(floatMatch[1]) * 100);
      }
      return 100;
    };

    let overlay = getOverlay();
    let lastBrightness = 0

    // If overlay is not present, poll until it appears
    if (!overlay) {
      const poller = setInterval(() => {
        overlay = getOverlay();
        if (overlay) {
          clearInterval(poller);
          this.monitorOverlayBrightness(); // Re-run now that overlay exists
        }
      }, 1000);
      return;
    }

    // Observe changes to the style attribute
    const observer = new MutationObserver(() => {
      const newBrightness = getBrightness(overlay);
      if (newBrightness !== lastBrightness) {
        this.sendSocketNotification("BRIGHTNESS_UPDATE", newBrightness);
        lastBrightness = newBrightness;
      }
    });
    observer.observe(overlay, { attributes: true, attributeFilter: ['style'] });
  },
})
