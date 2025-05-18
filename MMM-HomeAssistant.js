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
      this.monitorOverlayBrightness();
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
    let lastBrightness = getBrightness(overlay);

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
