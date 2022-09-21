import { JaegerTracer, opentracing } from 'jaeger-client';
import { ILogData } from './logger';
export interface ITracerConfig {
    useTracer: boolean;
    serviceName: string;
    reporter: {
        logspans: boolean;
        collectorEndpoint: string;
    };
    excludeClasses?: string[];
}
export declare type LogContext = opentracing.Span;
export declare const defaultConfig: ITracerConfig;
export declare class Tracer {
    readonly client: JaegerTracer;
    readonly config: ITracerConfig;
    readonly serviceName: string;
    constructor(optionsConfig: ITracerConfig);
    /**
     * Creates a new child span with the given name and parent context,
     * and adds a tag to the span with the service name
     */
    getSubContext(contextName: string, parentContext?: LogContext): LogContext | undefined;
    write(action: string, logData: ILogData, writeContext: LogContext): void;
}
/**
 * Singleton for returning instance of the Tracer class.
 */
export default function getDefaultTracer(): Tracer;