const APP_URL = process.env.NEXT_PUBLIC_APP_URL as string;
if (!APP_URL) {
  throw new Error("NEXT_PUBLIC_APP_URL is not set");
}

const API_URL = process.env.NEXT_PUBLIC_API_URL as string;
if (!API_URL) {
  throw new Error("NEXT_PUBLIC_API_URL is not set");
}

const ANON_KEY = process.env.NEXT_PUBLIC_ANON_KEY as string;
if (!ANON_KEY) {
  throw new Error("NEXT_PUBLIC_ANON_KEY is not set");
}

export { ANON_KEY, API_URL, APP_URL };
