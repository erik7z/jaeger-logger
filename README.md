# Jaeger Logger
> You can find this package on NPM: [jaeger-logger](https://www.npmjs.com/package/jaeger-logger)

Logging / tracing library for [JAEGER](https://www.jaegertracing.io/docs) client. 
Helps to create beautiful nested context related logs.

- Outputs formatted logs to console.
- Can be used together with in-built tracer for sending log spans to [JAEGER](https://www.jaegertracing.io/docs)
> [Read more about tracing in our small guide (russian)](./guides/jaeger/ru/jaeger-tracer.md)

# Installation 

```shell
npm i jaeger-logger # and its ready to use =)
```

## Basic Usage

```ts
import { Logger } from 'jaeger-logger'

const logger = new Logger('LOG_NAME')

// Add info log:
logger.info('request', { action: 'action name', data: { some_key: 'some_value' } })

// Add error log:
logger.error('error', { action: 'action name', err: e }) // e - Error instance

// After completion of writing spans, logs should be closed
logger.finish()
```

## Usage with tracer ([read more](https://www.jaegertracing.io/docs))
```ts
const logger = new Logger('traced_logs', {
  config: {
    tracerConfig: {
      useTracer: true,
      serviceName: 'api', // name of the service in Jaeger UI
      reporter: {
        logspans: true,
        collectorEndpoint: 'http://localhost:14268/api/traces', // Jaeger collector endpoint
      },
    }
  }
});

// add search tag to context:
logger.context.setTag('user_id', ctx.state?.user?._id)

// or group of tags:
logger.context.addTags({
  [opentracing.Tags.HTTP_URL]: ctx.originalUrl,
  [opentracing.Tags.HTTP_METHOD]: 'POST',
  'host': ctx.request?.headers["host"],
  'userAgent': ctx.request?.headers['user-agent'],
})

// add top level info log
logger.info('request', { action: 'action name', data: { some_key: 'some_value' } })

// create nested logger in parent logger context
const subLog = logger.getSubLogger('traced_nested_log')

// add log to sublog and close it
subLog.info('response', { data: { result: 'some result' } }).finish()

// close parent logger
logger.finish()
```
