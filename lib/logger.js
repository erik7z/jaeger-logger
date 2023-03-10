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
const lodash_1 = require("lodash");
// eslint-disable-next-line unicorn/prefer-node-protocol
const stream_1 = require("stream");
exports.defaultConfig = {
    excludeMethods: ['assertInitialized'],
    excludeClasses: ['Transaction', 'Logger'],
    consoleDepth: 3,
};
const defaultLogData = { type: 'info', message: '', data: undefined, queNumber: 0 };
exports.LOGGER = Symbol('LOGGER');
class Logger {
    // TODO: simplify options
    constructor(serviceName, options = {}) {
        var _a, _b;
        this.serviceName = serviceName;
        this.type = exports.LOGGER;
        this.isToCloseContext = true;
        /**
         * logging db queries (only sequelize)
         */
        this.db = (query = '', data = {}) => {
            var _a, _b, _c, _d;
            const databaseInstance = (_b = (_a = data.model) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : '';
            const queryType = (_c = data.type) !== null && _c !== void 0 ? _c : '';
            const subLog = this.getSubLogger(`sequelize${databaseInstance ? ': ' + databaseInstance : ''}`, this.context);
            if (subLog.context != undefined) {
                subLog.context.addTags({
                    [jaeger_client_1.opentracing.Tags.DB_INSTANCE]: databaseInstance,
                    [jaeger_client_1.opentracing.Tags.DB_STATEMENT]: query,
                });
                subLog.info(`${queryType} ${databaseInstance}`, { data: { query, args: [(_d = data.instance) === null || _d === void 0 ? void 0 : _d.dataValues] } });
                subLog.finish();
            }
        };
        /**
         * Wrap function call input/output
         * Creates sub span in logger context and records function request/response
         *
         * @param contextName - name of the span
         * @param function_ - function to be called
         * @param arguments_ - arguments for provided function
         */
        this.wrapCall = (contextName, function_, ...arguments_) => {
            const subLogger = this.getSubLogger(contextName, this.context);
            try {
                subLogger.info('request', { action: contextName, data: { args: arguments_ } });
                const response = function_.apply(function_, arguments_);
                const promise = Promise.resolve(response)
                    .then((data) => {
                    subLogger.info('response', { action: contextName, data: data || response });
                    return data;
                })
                    .catch((error) => {
                    // for async functions
                    subLogger.error('error', { action: contextName, err: error });
                    throw error;
                })
                    .finally(() => {
                    subLogger.finish();
                });
                if (response instanceof Promise) {
                    return promise;
                }
                return response;
            }
            catch (error) {
                // in case decorated function not async
                subLogger.error('error', { action: contextName, err: error });
                throw error;
            }
        };
        const { config: optionsConfig = {}, parentContext, createNewContext } = options;
        this.config = (0, deepmerge_1.default)(exports.defaultConfig, optionsConfig);
        if ((_b = (_a = this.config) === null || _a === void 0 ? void 0 : _a.tracerConfig) === null || _b === void 0 ? void 0 : _b.useTracer) {
            this.tracer = (0, tracer_1.getDefaultTracer)(serviceName, this.config.tracerConfig);
        }
        // TODO: simplify newcontext/subcontext
        if (this.tracer && (parentContext || createNewContext)) {
            // create new context or create subcontext if parent context provided
            this._context = this.tracer.getSubContext(serviceName, parentContext);
        }
    }
    // TODO: refactor to automatically close all subcontexts
    /**
     * Every logger context should be closed at the end, otherwise spans are not saved.
     */
    finish() {
        if (this.context) {
            this.context.finish();
        }
    }
    /**
     * It closes the tracer if it exists
     */
    closeTracer() {
        if (this.tracer) {
            this.tracer.client.close();
        }
    }
    /**
     * Proxying 'Tracer.Span.AddTags' method
     * It adds tags to the span.
     * @param keyValueMap - { [key: string]: any }
     * @returns The current instance of the class.
     */
    addTags(keyValueMap) {
        if (this.context) {
            this.context.addTags(keyValueMap);
        }
        return this;
    }
    /**
     * It returns the value of the private variable _context.
     * @returns The context property is being returned.
     */
    get context() {
        return this._context;
    }
    /**
     * Logging "info" type of message
     *
     * @param {string} action - The action that is being logged.
     * @param {ILogData} logData - ILogData = defaultLogData
     * @param {LogSpan} [context] - This is the context of the log. It's used to group logs together.
     * @returns A Logger object
     */
    info(action, logData = defaultLogData, context) {
        return this.write(action, Object.assign(Object.assign({}, logData), { type: 'info' }), context);
    }
    /**
     * Logging "error" message
     *
     * The first argument is a union type, which means it can be a string or an error. If it's a string, we use it as the
     * action. If it's an error, we use the default action and use the first argument as the error
     * @param {string | Error | unknown} actionOrError - This is the action that you want to log. It can be a string or an
     * error. If it's an error, the action will be set to 'error' and the error will be logged.
     * @param {ILogData} logData - ILogData = defaultLogData
     * @param {LogSpan} [context] - LogSpan - This is the context of the log. It's used to group logs together.
     * @returns A Logger object
     */
    error(actionOrError, logData = defaultLogData, context) {
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
    static logError(error, context, serviceName = 'Unknown service') {
        const logger = new Logger(serviceName);
        logger.error(error.message, context);
        throw error;
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
     * Export context data
     * Useful for transferring context to other microservice and create connected logs
     */
    extract() {
        const uberTrace = {};
        if (this.context && this.tracer) {
            this.tracer.client.inject(this.context, jaeger_client_1.opentracing.FORMAT_TEXT_MAP, uberTrace);
        }
        return uberTrace;
    }
    /**
     * Import context data
     * Useful for continuing logs of other microservice and create connected logs
     * @param contextName
     * @param trace
     */
    inject(contextName, trace) {
        let span_context;
        if (this.tracer) {
            span_context = this.tracer.client.extract(jaeger_client_1.opentracing.FORMAT_TEXT_MAP, trace);
        }
        return this.getSubLogger(contextName, span_context);
    }
    /**
     * It takes an array of arguments and returns a new array of arguments with all the heavy objects removed
     *
     * @param {an y[]} arguments_ - any[] - the arguments to be simplified
     * @param {string[]} excludeClasses - An array of class names that you want to exclude from the logging.
     * @returns An array of objects
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static simplifyArgs(arguments_, excludeClasses = []) {
        // TODO: filter out objects by size
        function applyFilters(arguments__) {
            arguments__ = _.cloneDeep(arguments__);
            arguments__ = Logger.replaceStreamRecursive(arguments__);
            arguments__ = Logger.replaceBufferRecursive(arguments__);
            arguments__ = Logger.replaceClassesRecursive(arguments__, excludeClasses);
            return arguments__;
        }
        if ((0, lodash_1.isArray)(arguments_)) {
            return (arguments_ || []).map((argument) => {
                if (argument instanceof Object || argument instanceof Buffer) {
                    argument = applyFilters(argument);
                }
                return argument;
            });
        }
        else if (arguments_ instanceof Object || arguments_ instanceof Buffer || arguments_ instanceof stream_1.Stream) {
            arguments_ = applyFilters(arguments_);
        }
        return arguments_;
    }
    /**
     * finds arg nested property by provided class name and replaces it with class name (string).
     * modifies original value.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static replaceClassesRecursive(argument, classNames, depth = 3) {
        var _a, _b;
        if (depth <= 0)
            return argument;
        if (_.isObject(argument) && classNames.includes((_a = argument.constructor) === null || _a === void 0 ? void 0 : _a.name)) {
            return (_b = argument.constructor) === null || _b === void 0 ? void 0 : _b.name;
        }
        _.forIn(argument, (value, key) => {
            var _a, _b;
            if (_.isObject(value)) {
                if (classNames.includes((_a = value.constructor) === null || _a === void 0 ? void 0 : _a.name))
                    argument[key] = (_b = value.constructor) === null || _b === void 0 ? void 0 : _b.name;
                else
                    return Logger.replaceClassesRecursive(value, classNames, depth - 1);
            }
        });
        return argument;
    }
    /**
     * finds Buffers in args recursively and replaces them with string 'Buffer'.
     * modifies original value.
     */
    static replaceBufferRecursive(argument, depth = 3) {
        if (Buffer.isBuffer(argument))
            return 'Buffer';
        if (depth > 0 && _.isObject(argument)) {
            _.forIn(argument, (value, key) => {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                argument[key] = Logger.replaceBufferRecursive(value, depth - 1);
            });
        }
        return argument;
    }
    /**
     * finds Streams in args recursively and replaces them with string 'Stream'.
     * modifies original value.
     */
    static replaceStreamRecursive(argument, depth = 3) {
        if (argument instanceof stream_1.Stream)
            return 'Stream';
        if (depth > 0 && _.isObject(argument)) {
            _.forIn(argument, (value, key) => {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                argument[key] = Logger.replaceStreamRecursive(value, depth - 1);
            });
        }
        return argument;
    }
    /**
     * Useful for masking some values.
     *
     * It takes an object, a key to search for, a new value to replace the key with, and a depth to search. It returns a new
     * object with the key replaced with the new value
     * @param {any} oldObject - The object you want to replace the properties in.
     * @param {string} searchKey - The key to search for in the object
     * @param {string} newValue - The value you want to replace the searchKey with.
     * @param [depth=5] - The depth of search for the key.
     * @returns A new object with the same properties as the old object, but with the value of the property with the key
     * `searchKey` replaced with `newValue`.
     */
    static replacePropertiesRecursive(oldObject, searchKey, newValue, depth = 5) {
        if (depth <= 0 || _.isObject(oldObject) !== true)
            return oldObject;
        const newObject = {};
        for (const key in oldObject) {
            if (key === searchKey) {
                newObject[key] = newValue;
            }
            else {
                newObject[key] = Logger.replacePropertiesRecursive(oldObject[key], searchKey, newValue, depth - 1);
            }
        }
        return newObject;
    }
    /**
     * Writes to the console and to the tracer
     * @param {string} action - The action that is being logged.
     * @param {ILogData} logData - ILogData = defaultLogData
     * @param context - The context object that is passed to the logger.
     * @returns The Logger instance.
     */
    write(action, logData = defaultLogData, context = this.context) {
        const { type, message, data, err, queNumber } = logData;
        const details = `(${this.serviceName}):${queNumber || ''}: ${action || ''}`;
        this.consoleWrite(type !== null && type !== void 0 ? type : 'error', message !== null && message !== void 0 ? message : '', details, data, err);
        if (context && this.tracer) {
            this.tracer.write(action, logData, context);
        }
        return this;
    }
    /**
     * Format & Log output to the console If the config says so
     */
    consoleWrite(type, message, details, data, 
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    error) {
        if (!this.config.writeToConsole)
            return;
        let color = '\u001B[33m%s\u001B[0m : \u001B[36m%s\u001B[0m';
        if (type === 'info') {
            console.log(color, details, message || '');
        }
        else {
            color = '\u001B[31m%s\u001B[0m';
            details = '';
            console.error(color, details, message || '', error);
        }
        if (data) {
            data = Logger.simplifyArgs(data, this.config.excludeClasses);
            console.dir(data, { colors: true, depth: this.config.consoleDepth });
        }
    }
}
exports.default = Logger;
