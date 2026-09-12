import crypto from 'node:crypto';

const required = [
  'CARD_GATEWAY_BASE_URL',
  'CARD_GATEWAY_MERCHANT_ID',
  'CARD_GATEWAY_API_PASSWORD',
];

export function cardGatewayConfigured(env = process.env) {
  return required.every((key) => String(env[key] || '').trim() !== '');
}

export function createMerchantReference(prefix = 'BAYAA') {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(5).toString('hex')}`;
}

/**
 * Hosted card checkout adapter.
 *
 * The exact endpoint and request fields are supplied by the merchant's bank/GIMTEL
 * contract. We intentionally do not invent an API URL or credentials.
 */
export function getCardGatewayConfig(env = process.env) {
  return {
    configured: cardGatewayConfigured(env),
    baseUrl: String(env.CARD_GATEWAY_BASE_URL || '').trim(),
    merchantId: String(env.CARD_GATEWAY_MERCHANT_ID || '').trim(),
    apiVersion: String(env.CARD_GATEWAY_API_VERSION || '100').trim(),
    currency: String(env.CARD_GATEWAY_CURRENCY || 'MRU').trim(),
    merchantName: String(env.CARD_GATEWAY_MERCHANT_NAME || 'BAYAA').trim(),
    returnUrl: String(env.CARD_GATEWAY_RETURN_URL || '').trim(),
  };
}

export function assertCardGatewayConfigured(env = process.env) {
  if (!cardGatewayConfigured(env)) {
    const missing = required.filter((key) => !String(env[key] || '').trim());
    const error = new Error(`Card gateway is not configured. Missing: ${missing.join(', ')}`);
    error.code = 'CARD_GATEWAY_NOT_CONFIGURED';
    throw error;
  }
}
