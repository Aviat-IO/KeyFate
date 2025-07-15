// Delay validation until runtime to avoid build-time errors
function getSupabaseServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return key;
}

// Export a lazy getter that only validates when accessed
let _cachedKey: string | undefined;

export function getSUPABASE_SERVICE_ROLE_KEY(): string {
  if (_cachedKey === undefined) {
    _cachedKey = getSupabaseServiceRoleKey();
  }
  return _cachedKey;
}
