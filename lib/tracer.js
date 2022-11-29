"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDefaultTracer = exports.defaultConfig = void 0;
const jaeger_client_1 = require("jaeger-client");
const logger_1 = __importDefault(require("./logger"));
const deepmerge_1 = __importDefault(require("deepmerge"));
exports.defaultConfig = {
    useTracer: false,
    reporter: {
        logspans: true,
    },
    excludeClasses: ['Transaction', 'Logger'],
};
let tracer;
/**
 * Singleton for returning instance of the Tracer class.
 */
const getDefaultTracer = (serviceName, config = {}) => {
    if (!tracer)
        tracer = new Tracer(serviceName, config);
    return tracer;
};
exports.getDefaultTracer = getDefaultTracer;
class Tracer {
    constructor(serviceName, optionsConfig) {
        this.serviceName = serviceName;
        this.config = (0, deepmerge_1.default)(exports.defaultConfig, optionsConfig);
        this.client = (0, jaeger_client_1.initTracer)(Object.assign({ serviceName, sampler: {
                type: 'const',
                param: 1,
            } }, this.config), {
            logger: {
                info(message) {
                    console.info('TRACER INFO', message);
                },
                error(message) {
                    console.error('TRACER ERROR', message);
                },
            },
        });
    }
    /**
     * Creates a new child span with the given name and parent context,
     * and adds a tag to the span with the service name
     */
    getSubContext(contextName, parentContext) {
        if (!contextName)
            return;
        const subContext = this.client.startSpan(contextName, Object.assign({}, (parentContext ? { childOf: parentContext } : {})));
        subContext.addTags({ [jaeger_client_1.opentracing.Tags.SPAN_KIND]: this.serviceName });
        return subContext;
    }
    // TODO: add tests for proper message output
    write(action, logData, context) {
        var _a;
        if (!this.config.useTracer)
            return;
        const { type, message, data, err } = logData;
        if (type === 'error')
            context.setTag(jaeger_client_1.opentracing.Tags.ERROR, true);
        if (data === null || data === void 0 ? void 0 : data.args)
            data.args = logger_1.default.simplifyArgs(data.args, this.config.excludeClasses);
        this.send(context, {
            action,
            details: Object.assign(Object.assign(Object.assign({}, (message ? { message } : {})), (data ? { data } : {})), (err
                ? {
                    isError: true,
                    err: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({}, (err.code ? { code: err.code } : {})), (err.status ? { status: err.status } : {})), (err.statusCode ? { statusCode: err.statusCode } : {})), (err.message ? { message: err.message } : typeof err === 'string' ? { message: err } : {})), (err.customMessage ? { customMessage: err.customMessage } : {})), (err.shortMessage ? { shortMessage: err.shortMessage } : {})), (err.detailedMessage ? { detailedMessage: err.detailedMessage } : {})), (err.stack ? { stack: err.stack } : {})), (err.body ? { stack: err.body } : {})), (((_a = err.response) === null || _a === void 0 ? void 0 : _a.body) ? { response: { body: err.response.body } } : {})),
                }
                : {})),
        });
    }
    send(context, keyValuePairs, timestamp) {
        context.log(keyValuePairs, timestamp);
        return context;
    }
}
exports.default = Tracer;
