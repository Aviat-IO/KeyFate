import { authConfig } from "@/lib/auth-config"
import type { Session } from "next-auth"
import { getServerSession } from "next-auth/next"

export default async function TestEnvPage() {
  const session = (await getServerSession(authConfig as any)) as Session | null
  const user = session?.user

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
                provider: "next-auth",
                error: null,
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
                    secretsCount: 0,
                    error: null,
                    userId: (user as any).id,
                    secrets: [],
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
                    allSecretsCount: 0,
                    error: null,
                    allSecrets: [],
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
