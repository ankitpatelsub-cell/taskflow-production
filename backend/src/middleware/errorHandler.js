const logger = require('../config/logger');

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const ctx = {
    method: req.method,
    url: req.url,
    userId: req.user?.id,
    status,
    err: err.message,
  };

  if (status >= 500) {
    logger.error({ ...ctx, stack: err.stack }, 'server_error');
    const isProd = process.env.NODE_ENV === 'production';
    return res.status(status).json({ error: isProd ? 'Internal server error' : err.message });
  }

  if (status >= 400) {
    logger.warn(ctx, 'request_error');
  }

  res.status(status).json({ error: err.message });
}

module.exports = errorHandler;
