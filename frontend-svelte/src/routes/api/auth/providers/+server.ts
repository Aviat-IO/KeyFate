import { json } from "@sveltejs/kit"
import type { RequestHandler } from "./$types"

export const GET: RequestHandler = async () => {
  const providers = {
    google: !!(
      process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.GOOGLE_CLIENT_ID !==
        "your-google-client-id.apps.googleusercontent.com" &&
      process.env.GOOGLE_CLIENT_SECRET !== "your-google-client-secret" &&
      process.env.GOOGLE_CLIENT_ID.endsWith(".apps.googleusercontent.com")
    ),
    email: !!(
      process.env.SENDGRID_API_KEY &&
      process.env.SENDGRID_ADMIN_EMAIL &&
      process.env.SENDGRID_API_KEY !== "your-sendgrid-api-key"
    ),
  }

  return json(providers)
}
