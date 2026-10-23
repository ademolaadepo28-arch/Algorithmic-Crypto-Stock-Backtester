import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import assetsRouter from './src/routes/assets.js';
import quotesRouter from './src/routes/quotes.js';
import backtestRouter from './src/routes/backtest.js';
import optimizeRouter from './src/routes/optimize.js';
import healthRouter from './src/routes/health.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 10000;

// Enable Cross-Origin Resource Sharing
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Request latency & telemetry middleware
app.use((req, res, next) => {
  const start = performance.now();
  res.on('finish', () => {
    const duration = Math.round(performance.now() - start);
    const cacheStatus = res.getHeader('X-Cache') || '-';
    console.log(`[HTTP] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms [Cache: ${cacheStatus}]`);
  });
  next();
});

// API Routes
app.use('/api/assets', assetsRouter);
app.use('/api/quotes', quotesRouter);
app.use('/api/backtest', backtestRouter);
app.use('/api/optimize', optimizeRouter);
app.use('/api/health', healthRouter);

// Root / Warmup probe endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Algorithmic Crypto & Stock Backtester API',
    version: '1.0.0',
    specification: 'Full-Stack Production MVP',
    status: 'ONLINE',
    endpoints: {
      assets: '/api/assets',
      quotes: '/api/quotes?symbol=BTC',
      backtest: 'POST /api/backtest',
      health: '/api/health'
    }
  });
});

// Global 404 handler
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Endpoint ${req.method} ${req.url} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(500).json({
    status: 'error',
    message: err.message || 'Internal server error'
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Algorithmic Backtester API listening on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`⚡ Warmup probe: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});

export default app;
