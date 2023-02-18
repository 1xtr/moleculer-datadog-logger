![Moleculer logo](http://moleculer.services/images/banner.png)

[![NPM version](https://img.shields.io/npm/v/@1xtr/moleculer-datadog-logger.svg)](https://www.npmjs.com/package/@1xtr/moleculer-datadog-logger) ![NPM Downloads](https://img.shields.io/npm/dw/@1xtr/moleculer-datadog-logger)

## Moleculer custom logger for Datadog

This is a fork
from [native Datadog logger](https://github.com/moleculerjs/moleculer/blob/e62016ea16c5c4e303738a66e3a7429237ea9042/src/loggers/datadog.js)

### Description

This logger add some options for native Datadog logger

### Install

```bash
$ npm install @1xtr/moleculer-datadog-logger --save
```
### Import

```js
// ES5 example
const CustomDatadogLogger = require('@1xtr/moleculer-datadog-logger');

// ES6+ example
import { CustomDatadogLogger } from '@1xtr/moleculer-datadog-logger';
```

### Usage

```js
module.exports = {
  logger: new CustomDatadogLogger({
    // put here your options
  })
}
```

### Default options


```js
const defaultOptions = {
  url: "https://http-intake.logs.us5.datadoghq.com/api/v2/logs",
  apiKey: process.env.DATADOG_API_KEY,
  ddSource: "moleculer",
  env: undefined,
  hostname: hostname(),
  objectPrinter: null,
  interval: 10 * 1000,
  excludeModules: [],
}
```

### Options example

```json5
{
  "interval": 5000,
  "excludeModules": [
    "broker",
    "registry",
    "discovery",
    "transporter",
    "$node",
    "transit",
    "cacher"
  ]
}
```
