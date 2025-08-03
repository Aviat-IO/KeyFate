// Delay validation until runtime to avoid build-time errors
function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return key;
}

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

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY is not set");
  }
  return key;
}

// Export lazy getters that only validate when accessed
let _cachedSupabaseKey: string | undefined;
let _cachedStripeKey: string | undefined;
let _cachedStripeWebhookSecret: string | undefined;
let _cachedEncryptionKey: string | undefined;

export function getSUPABASE_SERVICE_ROLE_KEY(): string {
  if (_cachedSupabaseKey === undefined) {
    _cachedSupabaseKey = getSupabaseServiceRoleKey();
  }
  return _cachedSupabaseKey;
}

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

// Lazy serverEnv object that only validates when properties are accessed
export const serverEnv = {
  get SUPABASE_SERVICE_ROLE_KEY(): string {
    return getSUPABASE_SERVICE_ROLE_KEY();
  },
  get STRIPE_SECRET_KEY(): string {
    return getSTRIPE_SECRET_KEY();
  },
  get STRIPE_WEBHOOK_SECRET(): string {
    return getSTRIPE_WEBHOOK_SECRET();
  },
  get ENCRYPTION_KEY(): string {
    return getENCRYPTION_KEY();
  },
};
