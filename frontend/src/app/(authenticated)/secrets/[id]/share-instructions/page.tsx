"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Copy, AlertTriangle, CheckCircle, Info, Send } from "lucide-react"
import { Separator } from "@/components/ui/separator"

function ShareDisplay({
  shareHex,
  shareNumber,
  shareName,
}: {
  shareHex: string | null
  shareNumber: number
  shareName: string
}) {
  const [copied, setCopied] = useState(false)

  if (!shareHex) {
    return null // Or some placeholder if a share is expected but missing
  }

  const handleCopy = () => {
    if (shareHex) {
      navigator.clipboard.writeText(shareHex)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={`share-${shareNumber}`} className="text-lg font-semibold">
        Share {shareNumber}: {shareName}
      </Label>
      <div className="flex items-center space-x-2">
        <Input
          id={`share-${shareNumber}`}
          readOnly
          value={shareHex}
          className="bg-muted truncate text-sm"
        />
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={handleCopy}
          aria-label={`Copy ${shareName}`}
        >
          {copied ? (
            <CheckCircle className="text-accent-foreground h-4 w-4" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      {copied && (
        <p className="text-accent-foreground text-xs">Copied to clipboard!</p>
      )}
      <p className="text-muted-foreground text-xs">
        This is {shareName}. Store it securely. You will need it along with
        other shares to recover the secret.
      </p>
    </div>
  )
}

function ShareInstructionsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [userManagedShares, setUserManagedShares] = useState<string[]>([])
  const [recipients, setRecipients] = useState<
    Array<{ name: string; email?: string | null }>
  >([])
  const [sssSharesTotal, setSssSharesTotal] = useState<number>(0)
  const [sssThreshold, setSssThreshold] = useState<number>(0)
  const [secretId, setSecretId] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [confirmedSent, setConfirmedSent] = useState(false)

  useEffect(() => {
    const id = searchParams.get("secretId")
    const total = parseInt(searchParams.get("sss_shares_total") || "0", 10)
    const threshold = parseInt(searchParams.get("sss_threshold") || "0", 10)
    const recipientsParam = searchParams.get("recipients")

    if (!id || total < 2 || threshold < 2 || threshold > total) {
      setError(
        "Critical information missing or invalid. Unable to display share instructions. Please try creating the secret again.",
      )
      return
    }

    let parsedRecipients: Array<{ name: string; email?: string | null }> = []
    if (recipientsParam) {
      try {
        parsedRecipients = JSON.parse(decodeURIComponent(recipientsParam))
      } catch {
        setError("Failed to parse recipients. Please re-create the secret.")
        return
      }
    }

    // Read shares from localStorage
    const local = localStorage.getItem(`keyfate:userManagedShares:${id}`)
    if (!local) {
      setError(
        "Could not find your shares in this browser. They may have expired or been cleared. Please re-create the secret.",
      )
      return
    }
    let parsed: { shares: string[]; expiresAt: number }
    try {
      parsed = JSON.parse(local)
      if (
        !Array.isArray(parsed.shares) ||
        typeof parsed.expiresAt !== "number"
      ) {
        throw new Error()
      }
    } catch {
      setError("Failed to parse your shares. Please re-create the secret.")
      return
    }
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(`keyfate:userManagedShares:${id}`)
      setError(
        "Your shares have expired (over 2 hours old). Please re-create the secret.",
      )
      return
    }
    if (parsed.shares.length !== total - 1) {
      setError("Share count mismatch. Please re-create the secret.")
      return
    }
    setSecretId(id)
    setUserManagedShares(parsed.shares)
    setSssSharesTotal(total)
    setSssThreshold(threshold)
    setRecipients(parsedRecipients)
  }, [searchParams])

  const handleProceed = () => {
    if (confirmedSent) {
      router.push("/dashboard")
      router.refresh()
    }
  }

  const isMinimalShares = sssSharesTotal === 2

  const getRecipientShareInfo = () => {
    if (isMinimalShares) {
      return recipients.map((recipient, idx) => ({
        recipient,
        share: userManagedShares[idx] || null,
        shareNumber: idx + 2,
      }))
    } else {
      return recipients.map((recipient, idx) => ({
        recipient,
        share: userManagedShares[idx + 1] || null,
        shareNumber: idx + 3,
      }))
    }
  }

  const recipientSharesInfo = getRecipientShareInfo()

  const createMailto = (
    recipient: { name: string; email?: string | null },
    share: string,
  ) => {
    if (!recipient.email || !share) return null
    const subject = encodeURIComponent("Your KeyFate Secret Share")
    const bodyParts = [
      `Hi ${recipient.name || "there"},`,
      "",
      `Here is your KeyFate secret share: ${share}`,
      "",
      "Please keep this very safe. You will need it (and one other share that KeyFate will provide if the secret expires) to reconstruct the original message.",
      "",
      "What is KeyFate? It's a dead man's switch service. The person who set this up has stored an encrypted message that will be made accessible to you if they fail to check in regularly.",
      "",
      "For more information on how to use this share for recovery, you will receive further instructions from KeyFate if/when the secret is triggered.",
    ]
    const body = encodeURIComponent(bodyParts.join("\n"))
    return `mailto:${recipient.email}?subject=${subject}&body=${body}`
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-12">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (
    !secretId ||
    userManagedShares.length === 0 ||
    !sssSharesTotal ||
    !sssThreshold
  ) {
    return (
      <div className="container mx-auto max-w-2xl px-4 py-12 text-center">
        <p>Loading share information...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-12">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-bold">
            Manage Your Secret Shares
          </CardTitle>
          <CardDescription className="text-muted-foreground text-center">
            Your secret has been successfully created and split into{" "}
            {sssSharesTotal} shares. You need {sssThreshold} shares to recover
            it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <Alert variant="default">
            <Info className="h-4 w-4" />
            <AlertTitle>Understanding Your Shares</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  <strong>KeyFate's Share (Share 0):</strong> We securely store
                  one share. This share alone cannot reveal your secret. It will
                  be automatically sent to ALL recipients if you miss your
                  check-ins.
                </li>
                {isMinimalShares ? (
                  <li>
                    <strong>Recipient Share (Share 1):</strong> Displayed below.
                    ALL recipients receive the SAME share. You MUST distribute
                    this share to each recipient separately via your own secure
                    channel. With only {sssSharesTotal} shares total, both
                    KeyFate's share and the recipient share are required to
                    recover the secret.
                  </li>
                ) : (
                  <>
                    <li>
                      <strong>Recipient Share (Share 1):</strong> ALL recipients
                      receive the SAME share. You MUST distribute this share to
                      each recipient separately via your own secure channel.{" "}
                      <strong>
                        This share never touches KeyFate servers after creation.
                      </strong>
                    </li>
                    <li>
                      <strong>
                        Backup Shares (Shares 2-{sssSharesTotal - 1}):
                      </strong>{" "}
                      Additional shares for redundancy. Store these securely
                      offline (paper wallet, password manager, etc.).
                    </li>
                  </>
                )}
              </ul>
            </AlertDescription>
          </Alert>

          <Separator />

          <Alert variant="default" className="bg-muted/50">
            <Info className="h-4 w-4" />
            <AlertTitle>Equal Share Distribution</AlertTitle>
            <AlertDescription>
              <p className="mb-2">
                All {recipients.length} recipient
                {recipients.length > 1 ? "s" : ""} receive the{" "}
                <strong>SAME</strong> share (Share 1). This prevents recipients
                from reconstructing the secret before KeyFate sends Share 0.
              </p>
              <p>
                You must distribute Share 1 to each recipient separately using
                your own secure channels (encrypted messaging, in person, etc.).
                This share never touches KeyFate servers after creation.
              </p>
            </AlertDescription>
          </Alert>

          <Separator />

          <div className="space-y-2">
            <ShareDisplay
              shareHex={userManagedShares[0]}
              shareNumber={1}
              shareName={`For ALL Recipients (${recipients.map((r) => r.name).join(", ")})`}
            />
            <Alert variant="default" className="mt-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Critical:</strong> You must send this exact share to
                each recipient individually. When your secret triggers, KeyFate
                will automatically send Share 0 to all recipients. Recipients
                combine Share 0 (from KeyFate) + Share 1 (from you) to
                reconstruct the secret.
              </AlertDescription>
            </Alert>
          </div>

          <Separator />

          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Distribution Checklist</h3>
            {recipients.map((recipient, index) => (
              <div
                key={`checklist-${index}`}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                <div className="flex-1">
                  <p className="font-medium">{recipient.name}</p>
                  <p className="text-muted-foreground text-sm">
                    {recipient.email || "No email provided"}
                  </p>
                </div>
                {recipient.email && (
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={
                        createMailto(recipient, userManagedShares[0]) || "#"
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Email Share
                    </a>
                  </Button>
                )}
              </div>
            ))}
          </div>

          {!isMinimalShares && userManagedShares.length > 1 && (
            <>
              <Separator />
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">
                  Backup Shares (Optional Redundancy)
                </h3>
                <p className="text-muted-foreground text-sm">
                  These additional shares provide redundancy. Store them
                  securely offline.
                </p>
                {userManagedShares.slice(1).map((share, index) => (
                  <ShareDisplay
                    key={`backup-${index}`}
                    shareHex={share}
                    shareNumber={index + 2}
                    shareName={`Backup Share ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}

          <Separator />

          <Alert variant="destructive" className="mt-6">
            <AlertTriangle className="mt-0.5 h-5 w-5" />
            <AlertTitle className="text-lg">
              CRITICAL: YOU Must Distribute Share 1!
            </AlertTitle>
            <AlertDescription className="text-foreground space-y-3">
              <p>
                For this dead man's switch to work, you <strong>MUST</strong>{" "}
                distribute Share 1 to each recipient via your own secure
                channel:
              </p>
              <ul className="list-disc space-y-1 pl-6">
                {recipients.map((recipient, idx) => (
                  <li key={`critical-${idx}`}>
                    <strong>{recipient.name}:</strong> Send Share 1 to{" "}
                    {recipient.email || "their secure contact"} using encrypted
                    messaging, password manager sharing, or in person
                  </li>
                ))}
              </ul>
              <p>
                <strong>What happens when triggered:</strong>
              </p>
              <ul className="list-disc space-y-1 pl-6">
                <li>KeyFate automatically sends Share 0 to all recipients</li>
                <li>
                  Recipients combine Share 0 (from KeyFate) + Share 1 (from you)
                  = reconstructed secret
                </li>
                <li>
                  If recipients don't have Share 1, they CANNOT recover the
                  secret
                </li>
              </ul>
              <p>
                <strong>Secure distribution methods:</strong>
              </p>
              <ul className="list-disc space-y-1 pl-6">
                <li>
                  Signal, Telegram, or other end-to-end encrypted messaging apps
                </li>
                <li>Password manager secure sharing (1Password, Bitwarden)</li>
                <li>Encrypted file (PGP, age) sent separately from password</li>
                <li>In-person handoff (paper, QR code, USB drive)</li>
                <li>
                  Email (use buttons above) - ensure recipient email is secure
                </li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="bg-background mt-8 flex items-center space-x-2 rounded-md border p-4 shadow">
            <Checkbox
              id="confirm-sent"
              checked={confirmedSent}
              onCheckedChange={(checked) =>
                setConfirmedSent(checked as boolean)
              }
              aria-label="Confirm shares distributed"
            />
            <Label
              htmlFor="confirm-sent"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              I have securely distributed all necessary shares as instructed and
              understand their importance.
            </Label>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end pt-6">
          <Button
            onClick={handleProceed}
            disabled={!confirmedSent || userManagedShares.length === 0}
            size="lg"
            className="w-full md:w-auto"
          >
            {confirmedSent
              ? "Proceed to Dashboard"
              : "Confirm Shares Distributed to Proceed"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

export default function ShareInstructionsPage() {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto max-w-2xl px-4 py-12 text-center">
          Loading share instructions...
        </div>
      }
    >
      <ShareInstructionsContent />
    </Suspense>
  )
}
