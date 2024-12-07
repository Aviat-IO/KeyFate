const ANON_KEY = Deno.env.get("ANON_KEY") ?? "";
if (!ANON_KEY) {
  throw new Error("ANON_KEY is not set");
}

const API_URL = Deno.env.get("API_URL") ?? "";
if (!API_URL) {
  throw new Error("API_URL is not set");
}

const DB_URL = Deno.env.get("DB_URL") ?? "";
if (!DB_URL) {
  throw new Error("DB_URL is not set");
}

const ENCRYPTION_KEY = Deno.env.get("ENCRYPTION_KEY") ?? "";
if (!ENCRYPTION_KEY) {
  throw new Error("ENCRYPTION_KEY is not set");
}

const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? "";
if (!SERVICE_ROLE_KEY) {
  throw new Error("SERVICE_ROLE_KEY is not set");
}

const SITE_URL = Deno.env.get("SITE_URL") ?? "";
if (!SITE_URL) {
  throw new Error("SITE_URL is not set");
}

const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY") ?? "";
if (!SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY is not set");
}

export {
  ANON_KEY,
  API_URL,
  DB_URL,
  ENCRYPTION_KEY,
  SENDGRID_API_KEY,
  SERVICE_ROLE_KEY,
  SITE_URL,
};
