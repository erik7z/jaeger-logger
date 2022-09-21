"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOGGER = exports.defaultConfig = void 0;
var tracer_1 = require("./tracer");
var jaeger_client_1 = require("jaeger-client");
var _ = __importStar(require("lodash"));
exports.defaultConfig = {
    excludeMethods: ['assertInitialized'],
    excludeClasses: ['Transaction', 'Logger'],
    consoleDepth: 3,
};
exports.LOGGER = Symbol('LOGGER');
var Logger = /** @class */ (function () {
    function Logger(serviceName, options) {
        if (options === void 0) { options = {}; }
        var _this = this;
        this.serviceName = serviceName;
        this.type = exports.LOGGER;
        this.isToCloseContext = true;
        /**
         * logging db queries (only sequelize)
         */
        this.db = function (query, data) {
            var _a;
            var _b, _c, _d, _e;
            if (query === void 0) { query = ''; }
            if (data === void 0) { data = {}; }
            var dbInstance = (_c = (_b = data.model) === null || _b === void 0 ? void 0 : _b.name) !== null && _c !== void 0 ? _c : '';
            var queryType = (_d = data.type) !== null && _d !== void 0 ? _d : '';
            var subLog = _this.getSubLogger("sequelize".concat(dbInstance ? ': ' + dbInstance : ''), _this.context);
            if (subLog.context != null) {
                subLog.context.addTags((_a = {},
                    _a[jaeger_client_1.opentracing.Tags.DB_INSTANCE] = dbInstance,
                    _a[jaeger_client_1.opentracing.Tags.DB_STATEMENT] = query,
                    _a));
                subLog.info("".concat(queryType, " ").concat(dbInstance), { data: { query: query, args: [(_e = data.instance) === null || _e === void 0 ? void 0 : _e.dataValues] } });
                subLog.finish();
            }
        };
        var optionsConfig = options.config, parentContext = options.parentContext, createNewContext = options.createNewContext;
        this.config = __assign(__assign({}, exports.defaultConfig), optionsConfig);
        this.tracer = (0, tracer_1.getDefaultTracer)(this.config.tracerConfig);
        if (parentContext || createNewContext) {
            // create new context or create subcontext if parent context provided
            this.context = this.tracer.getSubContext(this.serviceName, parentContext);
        }
    }
    /**
     * Every logger context should be closed at the end, otherwise spans are not saved.
     */
    Logger.prototype.finish = function () {
        if (this.context)
            this.context.finish();
    };
    Logger.prototype.write = function (action, logData, context) {
        var _a, _b;
        if (logData === void 0) { logData = { type: 'info', message: '', data: null, queNumber: 0 }; }
        if (context === void 0) { context = this.context; }
        var type = logData.type, message = logData.message, data = logData.data, err = logData.err, queNumber = logData.queNumber;
        var details = "(".concat(this.serviceName, "):").concat(queNumber || '', ": ").concat(action || '');
        this.consoleWrite(type !== null && type !== void 0 ? type : 'error', message !== null && message !== void 0 ? message : '', details, data, err);
        if (context && ((_b = (_a = this.config) === null || _a === void 0 ? void 0 : _a.tracerConfig) === null || _b === void 0 ? void 0 : _b.useTracer)) {
            this.tracer.write(action, logData, context);
        }
        return this;
    };
    /**
     * Format & Log output to the console If the config says so
     */
    Logger.prototype.consoleWrite = function (type, message, details, data, err) {
        if (!this.config.writeToConsole)
            return;
        var color = '\x1b[33m%s\x1b[0m : \x1b[36m%s\x1b[0m';
        if (type === 'info') {
            console.log(color, details, message || '');
        }
        else {
            color = '\x1b[31m%s\x1b[0m';
            details = '';
            console.error(color, details, message || '', err);
        }
        if (data) {
            data.args = Logger.simplifyArgs(data.args, this.config.excludeClasses);
            console.dir(data, { colors: true, depth: this.config.consoleDepth });
        }
    };
    Logger.prototype.info = function (action, logData, context) {
        if (logData === void 0) { logData = { message: '', data: null, queNumber: 0 }; }
        return this.write(action, __assign(__assign({}, logData), { type: 'info' }), context);
    };
    Logger.prototype.error = function (action, logData, context) {
        if (logData === void 0) { logData = { message: '', data: null, queNumber: 0 }; }
        return this.write(action, __assign(__assign({}, logData), { type: 'error' }), context);
    };
    /**
     * Static error logger to use without 'new'
     * logs an error and throws it
     * @deprecated **uses default config, so tracer will not work**
     */
    Logger.logError = function (e, ctx, serviceName) {
        if (serviceName === void 0) { serviceName = 'Unknown service'; }
        var logger = new Logger(serviceName);
        logger.error(e.message, ctx);
        throw e;
    };
    /**
     * Useful for getting nested logs.
     * Returns a new Logger instance with the given name and parentContext.
     * *don't forget to close this sub logger on completion!*
     */
    Logger.prototype.getSubLogger = function (name, parentContext) {
        if (parentContext === void 0) { parentContext = this.context; }
        return new Logger(name, { parentContext: parentContext, config: this.config });
    };
    /**
     * It takes an array of arguments and returns a new array of arguments with all the heavy objects removed
     * @param {any[]} args - any[] - the arguments to be simplified
     * @param {string[]} excludeClasses - An array of class names that you want to exclude from the logging.
     * @returns An array of objects
     */
    Logger.simplifyArgs = function (args, excludeClasses) {
        if (excludeClasses === void 0) { excludeClasses = []; }
        // TODO: filter out objects by size
        return (args || []).map(function (arg) {
            if (arg instanceof Object) {
                arg = _.cloneDeep(arg);
                arg = Logger.simplifyArgsClasses(arg, excludeClasses);
            }
            return arg;
        });
    };
    /**
     * finds arg nested property by provided class name and replaces it with class name (string).
     * modifies original value.
     */
    Logger.simplifyArgsClasses = function (arg, classNames, depth) {
        var _a, _b;
        if (depth === void 0) { depth = 3; }
        if (depth <= 0)
            return arg;
        if (_.isObject(arg) && classNames.includes((_a = arg.constructor) === null || _a === void 0 ? void 0 : _a.name)) {
            return (_b = arg.constructor) === null || _b === void 0 ? void 0 : _b.name;
        }
        _.forIn(arg, function (value, key) {
            var _a, _b;
            if (_.isObject(value)) {
                if (classNames.includes((_a = value.constructor) === null || _a === void 0 ? void 0 : _a.name))
                    arg[key] = (_b = value.constructor) === null || _b === void 0 ? void 0 : _b.name;
                else
                    return Logger.simplifyArgsClasses(value, classNames, depth - 1);
            }
        });
        return arg;
    };
    return Logger;
}());
exports.default = Logger;
