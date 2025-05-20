# MMM-HomeAssistant
A MagicMirror² module that creates an MQTT device with Home Assistant autodiscovery.

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
        deviceName: 'My MagicMirror',
        autodiscoveryTopic: 'homeassistant',
        monitorControl: true,
        brightnessControl: true,
        moduleControl: true,
        pm2ProcessName: 'mm',
    }
},
```

## Configuration options

| Option              | Possible values | Default            | Description                                                                 |
|---------------------|----------------|--------------------|-----------------------------------------------------------------------------|
| `mqttServer`        | `string`       | `mqtt://localhost` | MQTT Server Address                                                         |
| `mqttPort`          | `int`          | `1883`             | MQTT Port                                                                   |
| `deviceName`        | `string`       | `My MagicMirror`   | MQTT Device Name                                                            |
| `autodiscoveryTopic`| `string`       | `homeassistant`    | Autodiscovery topic for Home Assistant                                      |
| `monitorControl`    | `boolean`      | `false`            | Treat the display as an ON/OFF light entity                                 |
| `brightnessControl` | `boolean`      | `false`            | Treat the display as a light entity with brightness. Enables monitorControl! |
| `moduleControl`     | `boolean`      | `true`             | Make modules controllable as switch entities                                 |
| `pm2ProcessName`    | `string`       | `undefined`        | If set, allows MagicMirror to be restarted via Home Assistant                |

## Home Assistant Integration

Entities will appear automatically in Home Assistant if MQTT autodiscovery is enabled. You can control your MagicMirror from the Home Assistant dashboard or automations.

## Troubleshooting


## Developer commands

- `npm install` - Install devDependencies like ESLint.
- `npm run lint` - Run linting and formatter checks.
- `npm run lint:fix` - Fix linting and formatter issues.

[mm]: https://github.com/MagicMirrorOrg/MagicMirror
