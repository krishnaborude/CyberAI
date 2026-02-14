const LEVELS = {
  info: 'INFO',
  warn: 'WARN',
  error: 'ERROR'
};

function format(level, message, meta) {
  const timestamp = new Date().toISOString();
  const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
  return `[${timestamp}] [${level}] ${message}${suffix}`;
}

const logger = {
  info(message, meta) {
    console.log(format(LEVELS.info, message, meta));
  },
  warn(message, meta) {
    console.warn(format(LEVELS.warn, message, meta));
  },
  error(message, meta) {
    console.error(format(LEVELS.error, message, meta));
  }
};

module.exports = logger;