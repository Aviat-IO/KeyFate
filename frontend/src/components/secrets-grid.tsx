"use client"

import { SecretCard } from "@/components/secret-card"
import type { SecretWithRecipients } from "@/lib/types/secret-types"

interface SecretsGridProps {
  secrets: SecretWithRecipients[]
}

export function SecretsGrid({ secrets }: SecretsGridProps) {
  const activeSecrets = secrets.filter(
    (secret) => secret.status !== "triggered" && !secret.triggeredAt,
  )
  const sentSecrets = secrets.filter(
    (secret) => secret.status === "triggered" || secret.triggeredAt,
  )

  const sortedActiveSecrets = [...activeSecrets].sort((a, b) => {
    if (!a.nextCheckIn) return 1
    if (!b.nextCheckIn) return -1
    return new Date(a.nextCheckIn).getTime() - new Date(b.nextCheckIn).getTime()
  })

  const sortedSentSecrets = [...sentSecrets].sort((a, b) => {
    if (!a.triggeredAt) return 1
    if (!b.triggeredAt) return -1
    return new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
  })

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-4 lg:gap-6 xl:grid-cols-3">
        {sortedActiveSecrets.map((secret) => (
          <SecretCard key={secret.id} secret={secret} />
        ))}
      </div>

      {sentSecrets.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-6 text-2xl font-bold">Sent Secrets</h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-4 lg:gap-6 xl:grid-cols-3">
            {sortedSentSecrets.map((secret) => (
              <SecretCard key={secret.id} secret={secret} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
