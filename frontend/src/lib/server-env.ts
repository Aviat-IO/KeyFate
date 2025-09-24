// Delay validation until runtime to avoid build-time errors
function getStripeSecretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }
  return key;
}

function getStripeWebhookSecret(): string {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  }
  return secret;
}

function getBTCPayServerUrl(): string {
  const url = process.env.BTCPAY_SERVER_URL;
  if (!url) {
    throw new Error("BTCPAY_SERVER_URL is not set");
  }
  return url;
}

function getBTCPayApiKey(): string {
  const key = process.env.BTCPAY_API_KEY;
  if (!key) {
    throw new Error("BTCPAY_API_KEY is not set");
  }
  return key;
}

function getBTCPayStoreId(): string {
  const id = process.env.BTCPAY_STORE_ID;
  if (!id) {
    throw new Error("BTCPAY_STORE_ID is not set");
  }
  return id;
}

function getBTCPayWebhookSecret(): string {
  const secret = process.env.BTCPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("BTCPAY_WEBHOOK_SECRET is not set");
  }
  return secret;
}

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  return key;
}

// Export lazy getters that only validate when accessed
let _cachedStripeKey: string | undefined;
let _cachedStripeWebhookSecret: string | undefined;
let _cachedEncryptionKey: string | undefined;
let _cachedBTCPayServerUrl: string | undefined;
let _cachedBTCPayApiKey: string | undefined;
let _cachedBTCPayStoreId: string | undefined;
let _cachedBTCPayWebhookSecret: string | undefined;

export function getSTRIPE_SECRET_KEY(): string {
  if (_cachedStripeKey === undefined) {
    _cachedStripeKey = getStripeSecretKey();
  }
  return _cachedStripeKey;
}

export function getSTRIPE_WEBHOOK_SECRET(): string {
  if (_cachedStripeWebhookSecret === undefined) {
    _cachedStripeWebhookSecret = getStripeWebhookSecret();
  }
  return _cachedStripeWebhookSecret;
}

export function getENCRYPTION_KEY(): string {
  if (_cachedEncryptionKey === undefined) {
    _cachedEncryptionKey = getEncryptionKey();
  }
  return _cachedEncryptionKey;
}

export function getBTCPAY_SERVER_URL(): string {
  if (_cachedBTCPayServerUrl === undefined) {
    _cachedBTCPayServerUrl = getBTCPayServerUrl();
  }
  return _cachedBTCPayServerUrl;
}

export function getBTCPAY_API_KEY(): string {
  if (_cachedBTCPayApiKey === undefined) {
    _cachedBTCPayApiKey = getBTCPayApiKey();
  }
  return _cachedBTCPayApiKey;
}

export function getBTCPAY_STORE_ID(): string {
  if (_cachedBTCPayStoreId === undefined) {
    _cachedBTCPayStoreId = getBTCPayStoreId();
  }
  return _cachedBTCPayStoreId;
}

export function getBTCPAY_WEBHOOK_SECRET(): string {
  if (_cachedBTCPayWebhookSecret === undefined) {
    _cachedBTCPayWebhookSecret = getBTCPayWebhookSecret();
  }
  return _cachedBTCPayWebhookSecret;
}

// Lazy serverEnv object that only validates when properties are accessed
export const serverEnv = {
  get STRIPE_SECRET_KEY(): string {
    return getSTRIPE_SECRET_KEY();
  },
  get STRIPE_WEBHOOK_SECRET(): string {
    return getSTRIPE_WEBHOOK_SECRET();
  },
  get ENCRYPTION_KEY(): string {
    return getENCRYPTION_KEY();
  },
  get BTCPAY_SERVER_URL(): string {
    return getBTCPAY_SERVER_URL();
  },
  get BTCPAY_API_KEY(): string {
    return getBTCPAY_API_KEY();
  },
  get BTCPAY_STORE_ID(): string {
    return getBTCPAY_STORE_ID();
  },
  get BTCPAY_WEBHOOK_SECRET(): string {
    return getBTCPAY_WEBHOOK_SECRET();
  },
};
