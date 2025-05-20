# MMM-HomeAssistant
A MagicMirror² module that creates an MQTT device with autodiscovery in Home Assistant.

![Example of MMM-Template](./example_MMM-HomeAssistant.png)

[Module description]

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
        module: 'MMM-HomeAsssistant',
        config: {
            mqttServer: 'mqtt://localhost',
            mqttPort: 1883,
            deviceName: 'My MagicMirror',
            autodiscoveryTopic: 'homeasssistant',
            monitorControl: true,
            brightnessControl: true,
            moduleControl: true,
            pm2ProcessName: 'mm',
        }
    },
```

## Configuration options

Option|Possible values|Default|Description
------|------|------|-----------
`mqttServer`|`string`|`mqtt://localhost`|MQTT Server Address
`mqttPort`|`int`|`1883`|MQTT Port
`deviceName`|`string`|`mqtt://localhost`|MQTT Server Address
`autodiscoveryTopic`|`string`|`mqtt://localhost`|MQTT Server Address
`monitorControl`|`boolean`|`false`|Treat the display as an ON/OFF light entity
`brightnessControl`|`boolean`|`false`|Treat the display as a light entity with brightness. *This automatically enables `monitorControl` option!*
`moduleControl`|`boolean`|`true`|MQTT Server Address
`pm2ProcessName`|`string`|`mm`|MQTT Server Address

## Developer commands

- `npm install` - Install devDependencies like ESLint.
- `npm run lint` - Run linting and formatter checks.
- `npm run lint:fix` - Fix linting and formatter issues.

[mm]: https://github.com/MagicMirrorOrg/MagicMirror
