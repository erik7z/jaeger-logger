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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultTracer = exports.defaultConfig = void 0;
var jaeger_client_1 = require("jaeger-client");
var logger_1 = require("./logger");
var logger_2 = __importDefault(require("./logger"));
exports.defaultConfig = {
    useTracer: false,
    serviceName: 'api',
    reporter: {
        logspans: true,
        collectorEndpoint: '',
    },
    excludeClasses: logger_1.ExcludeClasses,
};
var tracer;
/**
 * Singleton for returning instance of the Tracer class.
 */
var getDefaultTracer = function () {
    if (!tracer)
        tracer = new Tracer(exports.defaultConfig);
    return tracer;
};
exports.getDefaultTracer = getDefaultTracer;
var Tracer = /** @class */ (function () {
    function Tracer(optionsConfig) {
        this.config = __assign(__assign({}, exports.defaultConfig), optionsConfig);
        this.serviceName = optionsConfig.serviceName;
        this.client = (0, jaeger_client_1.initTracer)(__assign({ sampler: {
                type: 'const',
                param: 1,
            } }, this.config), {
            logger: {
                info: function (msg) {
                    console.log('INFO ', msg);
                },
                error: function (msg) {
                    console.log('ERROR', msg);
                },
            },
        });
    }
    /**
     * Creates a new child span with the given name and parent context,
     * and adds a tag to the span with the service name
     */
    Tracer.prototype.getSubContext = function (contextName, parentContext) {
        var _a;
        if (!contextName)
            return;
        var subContext = this.client.startSpan(contextName, __assign({}, (parentContext ? { childOf: parentContext } : {})));
        subContext.addTags((_a = {}, _a[jaeger_client_1.opentracing.Tags.SPAN_KIND] = this.serviceName, _a));
        return subContext;
    };
    Tracer.prototype.write = function (action, logData, writeContext) {
        if (!this.config.useTracer)
            return;
        var type = logData.type, message = logData.message, data = logData.data, err = logData.err;
        if (type === 'error')
            writeContext.setTag(jaeger_client_1.opentracing.Tags.ERROR, true);
        if (data === null || data === void 0 ? void 0 : data.args)
            data.args = logger_2.default.simplifyArgs(data.args, this.config.excludeClasses);
        writeContext.log({
            action: action,
            details: __assign(__assign(__assign({}, (message ? { message: message } : {})), (data ? { data: data } : {})), (err
                ? {
                    isError: true,
                    err: __assign(__assign(__assign(__assign(__assign(__assign(__assign(__assign({}, (err.code ? { code: err.code } : {})), (err.status ? { status: err.status } : {})), (err.statusCode ? { statusCode: err.statusCode } : {})), (err.message ? { message: err.message } : {})), (err.customMessage ? { customMessage: err.customMessage } : {})), (err.shortMessage ? { shortMessage: err.shortMessage } : {})), (err.detailedMessage ? { detailedMessage: err.detailedMessage } : {})), (err.stack ? { stack: err.stack } : {})),
                }
                : {})),
        });
    };
    return Tracer;
}());
exports.default = Tracer;
