/**
 * pispiCertMonitor.js — mTLS certificate expiry monitor for PI-SPI.
 *
 * Call checkCertExpiry() at server startup and via daily cron.
 * Throws if fewer than 7 days remain (prevents server from starting with an expired cert).
 */

const fs     = require('fs');
const crypto = require('crypto');

function checkCertExpiry() {
  if (process.env.PISPI_MTLS_SKIP === 'true') {
    console.warn('[PISPI] Cert check skipped (PISPI_MTLS_SKIP=true)');
    return Infinity;
  }
  const certPath = process.env.PISPI_CERT_PATH;
  if (!certPath) throw new Error('PISPI_CERT_PATH is not configured');

  const certPem  = fs.readFileSync(certPath, 'utf8');
  const cert     = new crypto.X509Certificate(certPem);
  const expiresAt = new Date(cert.validTo);
  const daysLeft  = (expiresAt - Date.now()) / (1000 * 60 * 60 * 24);

  if (daysLeft < 7) {
    throw new Error(`PISPI mTLS cert expires in ${Math.floor(daysLeft)} days — RENEW NOW (${certPath})`);
  }
  if (daysLeft < 30) {
    console.warn(`[PISPI] mTLS cert expires in ${Math.floor(daysLeft)} days — schedule renewal`);
  }

  return Math.floor(daysLeft);
}

module.exports = { checkCertExpiry };
