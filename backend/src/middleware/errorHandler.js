function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) {
    console.error(err.stack);
    const isProd = process.env.NODE_ENV === 'production';
    return res.status(status).json({ error: isProd ? 'Internal server error' : err.message });
  }
  res.status(status).json({ error: err.message });
}

module.exports = errorHandler;
