import { createClient } from "@/utils/supabase/server"

export default async function TestEnvPage() {
  const supabase = await createClient()

  // Test user authentication
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  // Test database connection and secrets query
  let secretsData = null
  let secretsError = null
  let allSecretsData = null
  let allSecretsError = null

  if (user) {
    // Query for user's secrets
    const result = await supabase
      .from("secrets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    secretsData = result.data
    secretsError = result.error

    // Also query ALL secrets to see if any exist (for debugging)
    const allResult = await supabase
      .from("secrets")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(5)

    allSecretsData = allResult.data
    allSecretsError = allResult.error
  }

  return (
    <div className="container mx-auto p-8">
      <h1 className="mb-4 text-2xl font-bold">Environment Test</h1>

      <div className="space-y-4">
        <div className="rounded border p-4">
          <h2 className="font-semibold">User Authentication</h2>
          <pre className="mt-2 rounded bg-gray-100 p-2 text-sm">
            {JSON.stringify(
              {
                user: user?.id,
                email: user?.email,
                provider: user?.app_metadata?.provider,
                error: userError,
              },
              null,
              2,
            )}
          </pre>
        </div>

        {user && (
          <>
            <div className="rounded border p-4">
              <h2 className="font-semibold">User's Secrets Query</h2>
              <pre className="mt-2 rounded bg-gray-100 p-2 text-sm">
                {JSON.stringify(
                  {
                    secretsCount: secretsData?.length,
                    error: secretsError,
                    userId: user.id,
                    secrets: secretsData?.map((s) => ({
                      id: s.id,
                      title: s.title,
                      created_at: s.created_at,
                    })),
                  },
                  null,
                  2,
                )}
              </pre>
            </div>

            <div className="rounded border p-4">
              <h2 className="font-semibold">
                All Secrets (Last 5) - Debug Only
              </h2>
              <pre className="mt-2 rounded bg-gray-100 p-2 text-sm">
                {JSON.stringify(
                  {
                    allSecretsCount: allSecretsData?.length,
                    error: allSecretsError,
                    allSecrets: allSecretsData?.map((s) => ({
                      id: s.id,
                      title: s.title,
                      user_id: s.user_id,
                      created_at: s.created_at,
                    })),
                  },
                  null,
                  2,
                )}
              </pre>
            </div>
          </>
        )}

        <div className="rounded border p-4">
          <h2 className="font-semibold">Environment Variables</h2>
          <pre className="mt-2 rounded bg-gray-100 p-2 text-sm">
            {JSON.stringify(
              {
                NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
                NEXT_PUBLIC_ENV: process.env.NEXT_PUBLIC_ENV,
                NODE_ENV: process.env.NODE_ENV,
              },
              null,
              2,
            )}
          </pre>
        </div>
      </div>
    </div>
  )
}
