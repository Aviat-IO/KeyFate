const APP_URL = process.env.NEXT_PUBLIC_APP_URL as string;
if (!APP_URL) {
  throw new Error("NEXT_PUBLIC_APP_URL is not set");
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
if (!SUPABASE_URL) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
}

const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;
if (!SUPABASE_ANON_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is not set");
}

export { APP_URL, SUPABASE_ANON_KEY, SUPABASE_URL };
