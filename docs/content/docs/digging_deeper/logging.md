---
summary: Bentocache logs a lot of information throughout its execution. Learn how to plug in your own logger.
---

# Logging

In case you encounter any issues, or if you just want more visibility and information about what Bentocache is doing in production, you can plug in a custom logger when you create an instance of Bentocache.

Your logger must comply with the following interface:

```ts
export interface Logger {
  trace(msg: string | LogObject): void;
  trace(obj: LogObject, msg: string): void;

  debug(msg: string | LogObject): void;
  debug(obj: LogObject, msg: string): void;

  info(msg: string | LogObject): void;
  info(obj: LogObject, msg: string): void;

  warn(msg: string): void;
  warn(obj: LogObject, msg: string): void;

  error(msg: string): void;
  error(obj: ErrorObject, msg: string): void;

  fatal(msg: string): void;
  fatal(obj: ErrorObject, msg: string): void;

  child(childObj: LogObject): Logger;
}
```

A compatible logger is, for example, [Pino](https://github.com/pinojs/pino), which is the de-facto logger to use for modern Node.js projects.

Next, when you create your Bentocache instance, you can inject your logger. Example with Pino:

```ts
import { pino } from 'pino'

const logger = pino({
  level: 'trace',
  transport: { target: 'pino-pretty' }
})

const bento = new BentoCache({
  // ...
  logger,
})
```

Bentocache will create a child logger with the label `pkg: "bentocache"`, allowing you to filter easily on your end.

Sometimes other child loggers are created depending on the context. Also logs of various levels are generated throughout the execution: trace, error, info, etc...

You will discover this quite easily when trying it out.
