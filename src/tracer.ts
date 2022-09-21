import { initTracer, JaegerTracer, opentracing } from 'jaeger-client';
import { ExcludeClasses, ILogData } from './logger';
import Logger from './logger';

export interface ITracerConfig {
  useTracer: boolean;
  serviceName: string;
  reporter: {
    logspans: boolean;
    collectorEndpoint: string;
  };
  excludeClasses?: string[];
}

/* A wrapper for `opentracing.Span` */
export type LogContext = opentracing.Span;

export const defaultConfig: ITracerConfig = {
  useTracer: false,
  serviceName: 'api',
  reporter: {
    logspans: true,
    collectorEndpoint: '',
  },
  excludeClasses: ExcludeClasses,
};

let tracer: Tracer;
/**
 * Singleton for returning instance of the Tracer class.
 */
export const getDefaultTracer = () => {
  if (!tracer) tracer = new Tracer(defaultConfig);
  return tracer;
};

export default class Tracer {
  public readonly client: JaegerTracer;
  public readonly config: ITracerConfig;
  public readonly serviceName;

  constructor(optionsConfig: ITracerConfig) {
    this.config = { ...defaultConfig, ...optionsConfig };
    this.serviceName = optionsConfig.serviceName;
    this.client = initTracer(
      {
        sampler: {
          type: 'const',
          param: 1,
        },
        ...this.config,
      },
      {
        logger: {
          info(msg: string) {
            console.log('INFO ', msg);
          },
          error(msg: string) {
            console.log('ERROR', msg);
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

  write(action: string, logData: ILogData, writeContext: LogContext) {
    if (!this.config.useTracer) return;
    const { type, message, data, err } = logData;
    if (type === 'error') writeContext.setTag(opentracing.Tags.ERROR, true);
    if (data?.args) data.args = Logger.simplifyArgs(data.args, this.config.excludeClasses);

    writeContext.log({
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
}
