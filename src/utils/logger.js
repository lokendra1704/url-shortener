import winston, { format } from 'winston';
import { ENV } from './constants';

export const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'blue',
  http: 'purple',
  verbose: 'green',
  debug: 'yellow',
  silly: 'pink',
};

let combinedFormat = winston.format.combine(
  format.splat(),
);

if (process.env.APP_ENV === ENV.DEV) {
  combinedFormat = winston.format.combine(
    combinedFormat,
    format.colorize({ all: true, colors }),
  );
}

const logger = winston.createLogger({
  level: 'silly',
  levels: winston.config.npm.levels,
  transports: [
    new winston.transports.Console({
      format: combinedFormat,
    }),
  ],
});

// This will handle multiple versions of error logs currently used.
logger.error = (param, ...theArgs) => {
  if (param instanceof Error) {
    logger.log({ level: 'error', message: param });
  } else if (param.message) {
    logger.log({ level: 'error', ...param });
  } else {
    logger.log({ level: 'error', message: param, splat: theArgs });
  }
};

export default logger;
