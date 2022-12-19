import { JaegerTracer, opentracing } from 'jaeger-client';
import { ILogData } from './logger';
export interface ITracerConfig {
    useTracer: boolean;
    reporter: {
        logspans: boolean;
        collectorEndpoint?: string;
    };
    excludeClasses?: string[];
}
export declare type LogSpan = opentracing.Span;
export declare const defaultConfig: ITracerConfig;
/**
 * Singleton for returning instance of the Tracer class.
 */
export declare const getDefaultTracer: (serviceName: string, config?: Partial<ITracerConfig>) => Tracer;
export default class Tracer {
    readonly serviceName: string;
    readonly client: JaegerTracer;
    readonly config: ITracerConfig;
    constructor(serviceName: string, optionsConfig: Partial<ITracerConfig>);
    /**
     * Creates a new child span with the given name and parent context,
     * and adds a tag to the span with the service name
     */
    getSubContext(contextName: string, parentContext?: LogSpan): LogSpan | undefined;
    write(action: string, logData: ILogData, context: LogSpan): void;
    send(context: LogSpan, keyValuePairs: {
        [key: string]: unknown;
    }, timestamp?: number): LogSpan;
}
