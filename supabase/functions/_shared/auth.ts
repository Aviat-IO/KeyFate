import { SERVICE_ROLE_KEY } from "./env.ts";

/**
 * Validates that the request is authenticated with the service role key
 * This ensures only authorized internal services can call these functions
 */
export function validateServiceRoleAuth(req: Request): boolean {
  const authHeader = req.headers.get("Authorization");

  if (!authHeader) {
    console.error("Missing Authorization header");
    return false;
  }

  // Check if it's a Bearer token
  if (!authHeader.startsWith("Bearer ")) {
    console.error("Invalid Authorization header format - must be Bearer token");
    return false;
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix

  // Compare with service role key
  if (token !== SERVICE_ROLE_KEY) {
    console.error("Invalid service role key provided");
    return false;
  }

  return true;
}

/**
 * Creates an unauthorized response for failed authentication
 */
export function createUnauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({
      error: "Unauthorized",
      message: "Invalid or missing service role authentication",
    }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    },
  );
}
