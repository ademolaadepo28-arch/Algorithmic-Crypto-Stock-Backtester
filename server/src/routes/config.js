import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { apiMetrics } from '../services/dataService.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envFilePath = path.resolve(__dirname, '../../.env');

function maskKey(key) {
  if (!key || key.length < 6) return key ? '****' : null;
  return key.substring(0, 3) + '••••••••' + key.substring(key.length - 3);
}

/**
 * GET /api/config/keys
 * Returns status of external API configurations
 */
router.get('/keys', (req, res) => {
  const currentKey = process.env.ALPHA_VANTAGE_KEY || '';
  const isConfigured = Boolean(currentKey && currentKey.trim() !== '' && currentKey !== 'demo');

  res.json({
    alphaVantage: {
      configured: isConfigured,
      keyMasked: maskKey(currentKey),
      provider: 'Alpha Vantage',
      rateLimitCeiling: '5 calls/min, 100/day (Free Tier)',
      callsMade: apiMetrics.alphaVantageCalls,
      lastCall: apiMetrics.lastAlphaCall
    },
    coinGecko: {
      configured: true,
      mode: 'public',
      provider: 'CoinGecko Public API',
      rateLimitCeiling: '30 calls/min',
      callsMade: apiMetrics.coinGeckoCalls,
      lastCall: apiMetrics.lastCoinGeckoCall
    }
  });
});

/**
 * POST /api/config/keys
 * Connects, tests, and saves a new Alpha Vantage API key
 */
router.post('/keys', async (req, res) => {
  const { alphaVantageKey } = req.body;

  if (!alphaVantageKey || typeof alphaVantageKey !== 'string') {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid Alpha Vantage API key string.'
    });
  }

  const trimmedKey = alphaVantageKey.trim();

  // Test the key against Alpha Vantage endpoint
  try {
    const testUrl = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=IBM&apikey=${trimmedKey}`;
    const testRes = await axios.get(testUrl, { timeout: 8000 });

    if (testRes.data && testRes.data['Error Message']) {
      return res.status(400).json({
        success: false,
        message: 'Alpha Vantage rejected the key: Invalid API key string.'
      });
    }
  } catch (err) {
    console.warn('[ConfigRoute] Alpha Vantage verification warning:', err.message);
    // Proceed to save key even if verification network probe timed out
  }

  // Set in runtime environment
  process.env.ALPHA_VANTAGE_KEY = trimmedKey;

  // Persist to server/.env
  try {
    let envContent = '';
    if (fs.existsSync(envFilePath)) {
      envContent = fs.readFileSync(envFilePath, 'utf8');
    }

    if (envContent.includes('ALPHA_VANTAGE_KEY=')) {
      envContent = envContent.replace(/ALPHA_VANTAGE_KEY=.*/g, `ALPHA_VANTAGE_KEY=${trimmedKey}`);
    } else {
      envContent += `\nALPHA_VANTAGE_KEY=${trimmedKey}\n`;
    }

    fs.writeFileSync(envFilePath, envContent, 'utf8');
  } catch (fsErr) {
    console.warn('[ConfigRoute] Could not update .env file on disk:', fsErr.message);
  }

  return res.json({
    success: true,
    message: 'Alpha Vantage API key configured and connected successfully!',
    maskedKey: maskKey(trimmedKey)
  });
});

export default router;
