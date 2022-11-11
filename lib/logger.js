"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOGGER = exports.defaultConfig = void 0;
const tracer_1 = require("./tracer");
const jaeger_client_1 = require("jaeger-client");
const deepmerge_1 = __importDefault(require("deepmerge"));
const _ = __importStar(require("lodash"));
exports.defaultConfig = {
    excludeMethods: ['assertInitialized'],
    excludeClasses: ['Transaction', 'Logger'],
    consoleDepth: 3,
};
exports.LOGGER = Symbol('LOGGER');
class Logger {
    // TODO: simplify options
    constructor(serviceName, options = {}) {
        this.serviceName = serviceName;
        this.type = exports.LOGGER;
        this.isToCloseContext = true;
        /**
         * logging db queries (only sequelize)
         */
        this.db = (query = '', data = {}) => {
            var _a, _b, _c, _d;
            const dbInstance = (_b = (_a = data.model) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : '';
            const queryType = (_c = data.type) !== null && _c !== void 0 ? _c : '';
            const subLog = this.getSubLogger(`sequelize${dbInstance ? ': ' + dbInstance : ''}`, this.context);
            if (subLog.context != null) {
                subLog.context.addTags({
                    [jaeger_client_1.opentracing.Tags.DB_INSTANCE]: dbInstance,
                    [jaeger_client_1.opentracing.Tags.DB_STATEMENT]: query,
                });
                subLog.info(`${queryType} ${dbInstance}`, { data: { query, args: [(_d = data.instance) === null || _d === void 0 ? void 0 : _d.dataValues] } });
                subLog.finish();
            }
        };
        /**
         * Wrap function call input/output
         * Creates sub span in logger context and records function request/response
         *
         * @param contextName - name of the span
         * @param func - function to be called
         * @param args - arguments for provided function
         */
        this.wrapCall = (contextName, func, ...args) => {
            const subLogger = this.getSubLogger(contextName, this.context);
            try {
                subLogger.info('request', { action: contextName, data: { args } });
                const response = func.apply(func, args);
                const promise = Promise.resolve(response)
                    .then((data) => {
                    subLogger.info('response', { action: contextName, data: { return: data || response } });
                    return data;
                })
                    .catch((e) => {
                    // for async functions
                    subLogger.error('error', { action: contextName, err: e });
                    throw e;
                })
                    .finally(() => {
                    subLogger.finish();
                });
                if (response instanceof Promise === true) {
                    return promise;
                }
                return response;
            }
            catch (e) {
                // in case decorated function not async
                subLogger.error('error', { action: contextName, err: e });
                throw e;
            }
        };
        const { config: optionsConfig = {}, parentContext, createNewContext } = options;
        this.config = (0, deepmerge_1.default)(exports.defaultConfig, optionsConfig);
        this.tracer = (0, tracer_1.getDefaultTracer)(serviceName, this.config.tracerConfig);
        // TODO: simplify newcontext/subcontext
        if (parentContext || createNewContext) {
            // create new context or create subcontext if parent context provided
            this.context = this.tracer.getSubContext(serviceName, parentContext);
        }
    }
    /**
     * Every logger context should be closed at the end, otherwise spans are not saved.
     */
    finish() {
        if (this.context)
            this.context.finish();
    }
    write(action, logData = { type: 'info', message: '', data: null, queNumber: 0 }, context = this.context) {
        var _a, _b;
        const { type, message, data, err, queNumber } = logData;
        const details = `(${this.serviceName}):${queNumber || ''}: ${action || ''}`;
        this.consoleWrite(type !== null && type !== void 0 ? type : 'error', message !== null && message !== void 0 ? message : '', details, data, err);
        if (context && ((_b = (_a = this.config) === null || _a === void 0 ? void 0 : _a.tracerConfig) === null || _b === void 0 ? void 0 : _b.useTracer)) {
            this.tracer.write(action, logData, context);
        }
        return this;
    }
    /**
     * Format & Log output to the console If the config says so
     */
    consoleWrite(type, message, details, data, err) {
        if (!this.config.writeToConsole)
            return;
        let color = '\u001B[33m%s\u001B[0m : \u001B[36m%s\u001B[0m';
        if (type === 'info') {
            console.log(color, details, message || '');
        }
        else {
            color = '\u001B[31m%s\u001B[0m';
            details = '';
            console.error(color, details, message || '', err);
        }
        if (data) {
            data.args = Logger.simplifyArgs(data.args, this.config.excludeClasses);
            console.dir(data, { colors: true, depth: this.config.consoleDepth });
        }
    }
    info(action, logData = { message: '', data: null, queNumber: 0 }, context) {
        return this.write(action, Object.assign(Object.assign({}, logData), { type: 'info' }), context);
    }
    error(actionOrError, logData = { message: '', data: null, queNumber: 0 }, context) {
        let action = 'error';
        if (typeof actionOrError === 'string')
            action = actionOrError;
        else {
            logData = Object.assign(Object.assign({}, logData), { err: actionOrError });
        }
        return this.write(action, Object.assign(Object.assign({}, logData), { type: 'error' }), context);
    }
    /**
     * Static error logger to use without 'new'
     * logs an error and throws it
     *
     * @deprecated **uses default config where connection to jaeger not set, so tracer will not work**
     */
    static logError(e, ctx, serviceName = 'Unknown service') {
        const logger = new Logger(serviceName);
        logger.error(e.message, ctx);
        throw e;
    }
    /**
     * Useful for getting nested logs.
     * Returns a new Logger instance with the given name and parentContext.
     * *don't forget to close this sub logger on completion!*
     */
    getSubLogger(name, parentContext = this.context) {
        return new Logger(name, { parentContext, config: this.config });
    }
    /**
     * It takes an array of arguments and returns a new array of arguments with all the heavy objects removed
     *
     * @param {any[]} args - any[] - the arguments to be simplified
     * @param {string[]} excludeClasses - An array of class names that you want to exclude from the logging.
     * @returns An array of objects
     */
    static simplifyArgs(args, excludeClasses = []) {
        // TODO: filter out objects by size
        return (args || []).map((arg) => {
            if (arg instanceof Object || arg instanceof Buffer) {
                arg = _.cloneDeep(arg);
                arg = Logger.replaceBufferRecursive(arg);
                arg = Logger.replaceClassesRecursive(arg, excludeClasses);
            }
            return arg;
        });
    }
    /**
     * finds arg nested property by provided class name and replaces it with class name (string).
     * modifies original value.
     */
    static replaceClassesRecursive(arg, classNames, depth = 3) {
        var _a, _b;
        if (depth <= 0)
            return arg;
        if (_.isObject(arg) && classNames.includes((_a = arg.constructor) === null || _a === void 0 ? void 0 : _a.name)) {
            return (_b = arg.constructor) === null || _b === void 0 ? void 0 : _b.name;
        }
        _.forIn(arg, (value, key) => {
            var _a, _b;
            if (_.isObject(value)) {
                if (classNames.includes((_a = value.constructor) === null || _a === void 0 ? void 0 : _a.name))
                    arg[key] = (_b = value.constructor) === null || _b === void 0 ? void 0 : _b.name;
                else
                    return Logger.replaceClassesRecursive(value, classNames, depth - 1);
            }
        });
        return arg;
    }
    /**
     * finds Buffers in args recursively and replaces them with string 'Buffer'.
     * modifies original value.
     */
    static replaceBufferRecursive(arg, depth = 3) {
        if (Buffer.isBuffer(arg))
            return 'Buffer';
        if (depth > 0 && _.isObject(arg)) {
            _.forIn(arg, (value, key) => {
                // @ts-ignore
                arg[key] = Logger.replaceBufferRecursive(value, depth - 1);
            });
        }
        return arg;
    }
}
exports.default = Logger;
