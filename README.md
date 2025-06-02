# MMM-HomeAssistant
A MagicMirror² module that creates an MQTT device with Home Assistant autodiscovery.

> **Note:** This module was greatly inspired by [MMM-Remote-Control](https://github.com/Jopyth/MMM-Remote-Control).

![Example of MMM-HomeAssistant](./example_MMM-HomeAsisstant.png)
*Example: MagicMirror entities in Home Assistant*

## How it works

When the MagicMirror starts, the first browser client to load the module will establish the MQTT connection and handle all communication with Home Assistant. This ensures only one active MQTT connection per MagicMirror instance, even if multiple browsers are open.

The module uses MQTT autodiscovery to automatically create entities in Home Assistant, allowing you to control your MagicMirror from the Home Assistant dashboard or automations without manual configuration.

## Features

- MQTT device integration with Home Assistant via autodiscovery
- Control MagicMirror monitor (on/off)
- Adjust MagicMirror brightness
- Control visibility of individual MagicMirror modules as switches
- Restart MagicMirror process via Home Assistant

## Installation

### Install

In your terminal, go to your [MagicMirror²][mm] Module folder and clone MMM-HomeAssistant:

```bash
cd ~/MagicMirror/modules
git clone https://github.com/ambarusa/MMM-HomeAssistant/
cd MMM-HomeAssistant
npm install
```

### Update

```bash
cd ~/MagicMirror/modules/MMM-HomeAssistant
git pull
npm install
```

## Using the module

To use this module, add it to the modules array in the `config/config.js` file:

```js
{
    module: 'MMM-HomeAssistant',
    config: {
        mqttServer: 'mqtt://localhost',
        mqttPort: 1883,
        username: 'mqtt_username',
        password: 'mqtt_password',
        deviceName: 'My MagicMirror',
        autodiscoveryTopic: 'homeassistant',
        monitorControl: true,
        brightnessControl: true,
        moduleControl: true,
        monitorStatusCommand: 'xrandr --query | awk \'/Screen/ {print ($8 > 320) ? "true" : "false"}\'',
        monitorOnCommand: 'xrandr -d :0 --output HDMI-1 --auto --rotate right',
        monitorOffCommand: 'xrandr -d :0 --output HDMI-1 --off',
        pm2ProcessName: 'mm',
    }
},
```
*Example config for a Raspberry Pi 4B running MagicMirror server and client with PM2*

## Configuration options

| Option                | Type     | Default             | Description                                                                                                         |
|-----------------------|----------|---------------------|---------------------------------------------------------------------------------------------------------------------|
| `mqttServer`          | string   | `mqtt://localhost`  | MQTT server address (e.g., `mqtt://localhost`).                                                                     |
| `mqttPort`            | int      | `1883`              | MQTT port.                                                                                                          |
| `username`            | string   | *(none)*            | *(Optional)* MQTT username. If omitted, connects anonymously.                                                       |
| `password`            | string   | *(none)*            | *(Optional)* MQTT password.                                                                                         |
| `deviceName`          | string   | `My MagicMirror`    | MQTT device name.                                                                                                   |
| `autodiscoveryTopic`  | string   | `homeassistant`     | Autodiscovery topic for Home Assistant.                                                                             |
| `monitorControl`      | boolean  | `false`             | Treat the display as an ON/OFF light entity.                                                                        |
| `brightnessControl`   | boolean  | `false`             | Treat the display as a light entity with brightness. Enables monitorControl!                                        |
| `monitorStatusCommand`| string   | `echo true`         | Shell command to check the monitor status; must return `true`/`false` or `0`/`1` for correct operation.             |
| `monitorOnCommand`    | string   | *(none)*            | Shell command to turn on the monitor.                                                                               |
| `monitorOffCommand`   | string   | *(none)*            | Shell command to turn off the monitor.                                                                              |
| `moduleControl`       | boolean  | `true`              | Make modules controllable as switch entities.                                                                       |
| `pm2ProcessName`      | string   | *(none)*            | If set, allows MagicMirror to be restarted via Home Assistant.                                                      |

## Home Assistant Integration

Entities will appear automatically in Home Assistant if MQTT autodiscovery is enabled. You can control your MagicMirror from the Home Assistant dashboard or automations.

## Setting up MQTT on Home Assistant

### Installation of MQTT integration

Navigate to **Settings -> Integrations** and activate the MQTT integration, if it isn't active yet. See [MQTT Integration](https://www.home-assistant.io/integrations/mqtt/) for detailed instructions. It is recommended that you use the official Mosquitto addon.

### Credential creation

In Home Assistant, Mosquitto leverages HA users for authorization. Navigate to **Settings -> People** and create a new user (not person). The credentials of that user is what you will put into your module configuration.

### Autodiscovery

The HomeAssistant MQTT integration will automatically discover any device that posts MQTT messages in the correct format to a preconfigured topic. By default, that topic is `homeassistant`. There is no need to change it unless you have a specific requirement to do so.

Autodiscovery usually happens within seconds of the device posting to the topic. 

### Configuration for HA

| Option                | Suggested value             | Explanation                                                                                                              |
|-----------------------|-----------------------------|--------------------------------------------------------------------------------------------------------------------------|
| `mqttServer`          | `mqtt://homeassistant`      | If you are running the default Mosquitto, the DNS name by which you access your home assistand UI is the correct value. |
| `mqttPort`            | `1883`                      | By default, HomeAssistant Mosquitto uses the default ports for MQTT, so this should be left at the default value.                                                                                                              |
| `username`            | `your mqtt user's login`    | Must be set, HA Mosquitto does not support anonymous access.                                                             |
| `password`            | `your mqtt user's password` | Must be set, HA Mosquitto does not support anonymous access.                                                             |
| `deviceName`          | `My MagicMirror`            | This will be the device name registered in HomeAssistant. Entity names are auto-generated from this.                                |
| `autodiscoveryTopic`  | `homeassistant`             | 'homeassistant' is the default in HA. Unless you changed it, you should leave it at the default.                         |

### Example configuration

```js
{
    module: 'MMM-HomeAssistant',
    config: {
        mqttServer: 'mqtt://homeassistant',
        mqttPort: 1883,
        username: 'magicmirror',
        password: '<your password>',
        deviceName: 'Bathroom mirror',
        autodiscoveryTopic: 'homeassistant',
        monitorControl: true,
        brightnessControl: true,
        moduleControl: true,
        monitorStatusCommand: 'xrandr -d :0 --query | awk \'/Screen/ {print ($8 > 320) ? "true" : "false"}\'',
        monitorOnCommand: 'echo "on 0"|cec-client -s',
        monitorOffCommand: 'echo "standby 0"|cec-client -s',
    }
}
```
*Example config for a typical HomeAssistant installation*

## Troubleshooting

- Open your browser's developer console to check for JavaScript errors or warnings.
- Check the MagicMirror logs for errors or warnings (run `npm start` `npm run server` or `pm2 restart xx; pm2 logs xx` from your MagicMirror directory and watch the terminal output). It can help to comment out all modules but MMM-HomeAssistant in the config.
- Check the logs for messages. All log messages from this module are prefixed by the string `[MMM-HomeAssistant]` for ease of filtering.
- Use [MQTT Explorer](https://mqtt-explorer.com/) or a similar tool to easily investigate MQTT messages and topics.
- Optionally, you can temporarily change the `autodiscoveryTopic` in your config to something like `debug` to see what messages are intended to be sent for Home Assistant autodiscovery.

## Solving monitor control issues

- If the default `xrandr` command leaves your monitor with an ugly "no input" message, you can try installing the `cec-utils` package and try `echo "standby 0"|cec-client -s` and `echo "on 0"|cec-client -s` to control your monitor directly (depending on your monitor, this may or may not work)
- If the above cec-client commands result in a blank screen after turning the monitor back on, add the following to your `/boot/firmware/config.txt` under the general section to force output of a hdmi signal even if autodetection of a display fails:

```ini
hdmi_force_hotplug=1
hdmi_group=1
hdmi_mode=16
```

## Developer commands

- `npm install` - Install devDependencies like ESLint.
- `npm run lint` - Run linting and formatter checks.
- `npm run lint:fix` - Fix linting and formatter issues.

[mm]: https://github.com/MagicMirrorOrg/MagicMirror
