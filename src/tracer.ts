import { initTracer, JaegerTracer, opentracing } from 'jaeger-client';
import { ILogData } from './logger';
import Logger from './logger';
import deepmerge from 'deepmerge';

export interface ITracerConfig {
  useTracer: boolean;
  reporter: {
    logspans: boolean;
    collectorEndpoint?: string;
  };
  excludeClasses?: string[];
}

/* A wrapper for `opentracing.Span` */
export type LogContext = opentracing.Span;

export const defaultConfig: ITracerConfig = {
  useTracer: false,
  reporter: {
    logspans: true,
  },
  excludeClasses: ['Transaction', 'Logger'],
};

let tracer: Tracer;
/**
 * Singleton for returning instance of the Tracer class.
 */
export const getDefaultTracer = (serviceName: string, config: Partial<ITracerConfig> = {}) => {
  if (!tracer) tracer = new Tracer(serviceName, config);
  return tracer;
};

export default class Tracer {
  public readonly client: JaegerTracer;
  public readonly config: ITracerConfig;

  constructor(public readonly serviceName: string, optionsConfig: Partial<ITracerConfig>) {
    this.config = deepmerge(defaultConfig, optionsConfig);

    this.client = initTracer(
      {
        serviceName,
        sampler: {
          type: 'const',
          param: 1,
        },
        ...this.config,
      },
      {
        logger: {
          info(msg: string) {
            console.info('TRACER INFO ', msg);
          },
          error(msg: string) {
            console.error('TRACER ERROR', msg);
          },
        },
      },
    );
  }

  /**
   * Creates a new child span with the given name and parent context,
   * and adds a tag to the span with the service name
   */
  getSubContext(contextName: string, parentContext?: LogContext): LogContext | undefined {
    if (!contextName) return;
    const subContext: LogContext = this.client.startSpan(contextName, {
      ...(parentContext ? { childOf: parentContext } : {}),
    });
    subContext.addTags({ [opentracing.Tags.SPAN_KIND]: this.serviceName });
    return subContext;
  }

  // TODO: add tests for proper message output
  write(action: string, logData: ILogData, context: LogContext) {
    if (!this.config.useTracer) return;
    const { type, message, data, err } = logData;
    if (type === 'error') context.setTag(opentracing.Tags.ERROR, true);
    if (data?.args) data.args = Logger.simplifyArgs(data.args, this.config.excludeClasses);

    this.send(context, {
      action,
      details: {
        ...(message ? { message } : {}),
        ...(data ? { data } : {}),
        ...(err
          ? {
              isError: true,
              err: {
                ...(err.code ? { code: err.code } : {}),
                ...(err.status ? { status: err.status } : {}),
                ...(err.statusCode ? { statusCode: err.statusCode } : {}),
                ...(err.message ? { message: err.message } : {}),
                ...(err.customMessage ? { customMessage: err.customMessage } : {}),
                ...(err.shortMessage ? { shortMessage: err.shortMessage } : {}),
                ...(err.detailedMessage ? { detailedMessage: err.detailedMessage } : {}),
                ...(err.stack ? { stack: err.stack } : {}),
              },
            }
          : {}),
      },
    });
  }

  send(context: LogContext, keyValuePairs: { [key: string]: any }, timestamp?: number): LogContext {
    context.log(keyValuePairs, timestamp);
    return context;
  }
}
