const pino = require('pino');

const isDev = process.env.NODE_ENV !== 'production';

let transport;
if (isDev) {
  try {
    // pino-pretty gives colourised, human-readable output in dev
    require.resolve('pino-pretty');
    transport = {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:HH:MM:ss',
        ignore: 'pid,hostname',
      },
    };
  } catch {
    // pino-pretty not installed — fall back to plain JSON
  }
}

const logger = pino({ level: isDev ? 'debug' : 'info' }, transport ? pino.transport(transport) : undefined);

module.exports = logger;
