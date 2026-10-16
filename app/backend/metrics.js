import client from 'prom-client';

client.collectDefaultMetrics();

const httpDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});

function metricsMiddleware(req, res, next) {
  const end = httpDuration.startTimer();
  res.on('finish', () => {
    end({
      method: req.method,
      // baseUrl + route.path gives the full pattern, like /api/posts/:id, for routers mounted with app.use
      route: req.route ? req.baseUrl + req.route.path : 'unmatched',
      status_code: res.statusCode,
    });
  });
  next();
}

async function metricsHandler(req, res) {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
}

export { metricsMiddleware, metricsHandler };