/*
 * moleculer
 * Copyright (c) 2019 MoleculerJS (https://github.com/moleculerjs/moleculer)
 * MIT Licensed
 */

/**
 * @typedef {import('moleculer').LoggerFactory} LoggerFactory
 * @typedef {import('moleculer').Loggers.Base} BaseLogger
 */

/**
 * @typedef {Object} DDLoggerOptions
 * @property {string} [url="https://http-intake.logs.us5.datadoghq.com/api/v2/logs"] DataDog logs endpoint
 * @property {string} [apiKey=process.env.DATADOG_API_KEY] DataDog API Key, default process.env.DATADOG_API_KEY
 * @property {string} [env=undefined] DataDog environment
 * @property {string} [ddSource='moleculer'] Default is process.env.MOL_NODE_NAME if set or 'moleculer'
 * @property {string} [hostname='hostname'] Hostname, default is machine hostname 'os.hostname()'
 * @property {Function} [objectPrinter=null] Callback function for object printer, default is 'JSON.stringify'
 * @property {number} [interval=10000] Date uploading interval in milliseconds, default is 10000
 * @property {string[]} [excludeModules=[]] Exclude modules from logs, 'broker', 'registry' etc.
 */

'use strict';
import _ from 'lodash';
import { Loggers, Errors } from 'moleculer';
import { hostname } from 'os';

const isObject = (o) => o !== null && typeof o === 'object' && !(o instanceof String);

const replacerFunc = () => {
  const visited = new WeakSet();
  return (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (visited.has(value)) {
        return;
      }
      visited.add(value);
    }
    return value;
  };
};

const [NODE_VERSION] = process.versions.node.split('.');
if (NODE_VERSION < 18) {
  require('isomorphic-fetch');
}
/**
 * Datadog logger for Moleculer
 *
 * @class CustomDatadogLogger
 * @extends {BaseLogger}
 */
export class CustomDatadogLogger extends Loggers.Base {
  /**
   * Creates an instance of CustomDatadogLogger.
   * @param {DDLoggerOptions} opts
   * @memberof CustomDatadogLogger
   */
  constructor(opts) {
    super(opts);

    this.opts = _.defaultsDeep(this.opts, {
      url: 'https://http-intake.logs.us5.datadoghq.com/api/v2/logs',
      apiKey: process.env.DATADOG_API_KEY,
      ddSource: 'moleculer',
      env: undefined,
      hostname: hostname(),
      objectPrinter: null,
      interval: 10 * 1000,
      excludeModules: [],
    });

    this.queue = [];
    this.timer = null;

    if (!this.opts.apiKey)
      throw new Errors.MoleculerError(
        'Datadog API key is missing. Set DATADOG_API_KEY environment variable.'
      );
  }

  /**
   * Initialize logger.
   * @param {LoggerFactory} loggerFactory
   */
  init(loggerFactory) {
    super.init(loggerFactory);

    this.objectPrinter = this.opts.objectPrinter
      ? this.opts.objectPrinter
      : (obj) => JSON.stringify(obj, replacerFunc());

    if (this.opts.interval > 0) {
      this.timer = setInterval(() => this.flush(), this.opts.interval);
      this.timer.unref();
    }
  }

  /**
   * Stopping logger
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    return this.flush();
  }

  /**
   * Generate a new log handler.
   * @param {object} bindings
   */
  getLogHandler(bindings) {
    let level = bindings ? this.getLogLevel(bindings.mod) : null;
    if (!level) return null;

    const printArgs = (args) => {
      return args.map((p) => {
        if (isObject(p) || Array.isArray(p)) return this.objectPrinter(p);
        if (typeof p === 'string') return p.trim();
        return p;
      });
    };
    const levelIdx = Loggers.Base.LEVELS.indexOf(level);

    return (type, args) => {
      const typeIdx = Loggers.Base.LEVELS.indexOf(type);
      if (typeIdx > levelIdx) return;

      // allow only `error` and `fatal` from broker
      if (
        this.opts.excludeModules.includes(bindings.mod) &&
        !(bindings.mod === 'broker' && typeIdx <= 1)
      ) {
        return;
      }

      this.queue.push({
        ts: Date.now(),
        level: type,
        msg: printArgs(args).join(' '),
        bindings,
      });
      if (!this.opts.interval) this.flush();
    };
  }

  getTags(row) {
    const tags = [
      { name: 'env', value: this.opts.env || '' },
      { name: 'nodeID', value: row.bindings.nodeID },
      { name: 'namespace', value: row.bindings.ns },
    ];

    if (row.bindings.svc) tags.push({ name: 'service', value: row.bindings.svc });

    return tags.map((row) => `${row.name}:${row.value}`).join(',');
  }

  /**
   * Flush queued log entries to Datadog.
   */
  flush() {
    if (this.queue.length > 0) {
      const rows = Array.from(this.queue);
      this.queue.length = 0;

      const data = rows.map((row) => {
        // {"message":"hello world", "ddsource":"moleculer", "ddtags":"env:,user:icebob", "hostname":"bobcsi-pc"}

        return {
          timestamp: row.ts,
          level: row.level,
          message: row.msg,
          nodeID: row.bindings.nodeID,
          namespace: row.bindings.ns,
          service: row.bindings.svc,
          version: row.bindings.ver,

          ddsource: this.opts.ddSource,
          ddtags: this.getTags(row),
          hostname: this.opts.hostname,
        };
      });

      return fetch(this.opts.url, {
        method: 'post',
        body: JSON.stringify(data),
        headers: {
          'DD-API-KEY': this.opts.apiKey,
          'Content-Type': 'application/json',
        },
      })
        .then((/*res*/) => {
          // console.info("Logs are uploaded to DataDog. Status: ", res.statusText);
        })
        .catch((err) => {
          /* istanbul ignore next */
          // eslint-disable-next-line no-console
          console.warn('Unable to upload logs to Datadog server. Error:' + err.message, err);
        });
    }

    return this.broker.Promise.resolve();
  }
}
