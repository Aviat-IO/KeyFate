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
            <CheckCircle className="h-4 w-4 text-green-500" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
      {copied && <p className="text-xs text-green-600">Copied to clipboard!</p>}
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
  const [recipientName, setRecipientName] = useState<string | null>(null)
  const [recipientEmail, setRecipientEmail] = useState<string | null>(null)
  const [sssSharesTotal, setSssSharesTotal] = useState<number>(0)
  const [sssThreshold, setSssThreshold] = useState<number>(0)
  const [secretId, setSecretId] = useState<string | null>(null)

  const [error, setError] = useState<string | null>(null)
  const [confirmedSent, setConfirmedSent] = useState(false)

  useEffect(() => {
    const id = searchParams.get("secretId")
    const total = parseInt(searchParams.get("sss_shares_total") || "0", 10)
    const threshold = parseInt(searchParams.get("sss_threshold") || "0", 10)
    const rName = searchParams.get("recipient_name")
    const rEmail = searchParams.get("recipient_email")

    if (!id || total < 2 || threshold < 2 || threshold > total) {
      setError(
        "Critical information missing or invalid. Unable to display share instructions. Please try creating the secret again.",
      )
      return
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
      // Delete the shares from localStorage
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
    setRecipientName(rName)
    setRecipientEmail(rEmail)
  }, [searchParams])

  const handleProceed = () => {
    if (confirmedSent) {
      router.push("/dashboard")
      router.refresh()
    }
  }

  // For 2-share scenario: only recipient share exists (no personal share for user)
  // For 3+ share scenario: first is personal, second is recipient, rest are additional
  const isMinimalShares = sssSharesTotal === 2
  const primaryRecipientShare = isMinimalShares
    ? userManagedShares[0]
    : userManagedShares.length > 1
      ? userManagedShares[1]
      : null

  let recipientShareMailto = null
  if (recipientEmail && primaryRecipientShare) {
    const subject = encodeURIComponent("Your KeyFate Secret Share")
    const bodyParts = [
      `Hi ${recipientName || "there"},`,
      "", // For a blank line
      `Here is your KeyFate secret share: ${primaryRecipientShare}`,
      "",
      "Please keep this very safe. You will need it (and one other share that KeyFate will provide if the secret expires) to reconstruct the original message.",
      "",
      "What is KeyFate? It's a dead man\'s switch service. The person who set this up has stored an encrypted message that will be made accessible to you if they fail to check in regularly.",
      "",
      "For more information on how to use this share for recovery, you will receive further instructions from KeyFate if/when the secret is triggered.",
    ]
    const body = encodeURIComponent(bodyParts.join("\n")) // Join with newline, then encode the whole thing
    recipientShareMailto = `mailto:${recipientEmail}?subject=${subject}&body=${body}`
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

  // const usersPersonalShare = userManagedShares[0]
  const additionalDistributableShares = isMinimalShares
    ? []
    : userManagedShares.slice(2)

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
                  <strong>
                    KeyFate's Share (Share 1 of {sssSharesTotal}):
                  </strong>{" "}
                  We securely store one share. This share alone cannot reveal
                  your secret. It will be sent to{" "}
                  {recipientName || "your primary recipient"} if you miss your
                  check-ins.
                </li>
                {isMinimalShares ? (
                  <li>
                    <strong>
                      Recipient's Share (Share 2 of {sssSharesTotal}):
                    </strong>{" "}
                    Displayed below. This is for{" "}
                    {recipientName || "your primary recipient"}. You MUST send
                    this to them. With only 2 shares total, both KeyFate's share
                    and this recipient share are required to recover the secret.
                  </li>
                ) : (
                  <>
                    <li>
                      <strong>
                        Your Personal Share (Share 2 of {sssSharesTotal}):
                      </strong>{" "}
                      Displayed below. This is `Share #1` in the list below.
                      Keep this share extremely safe and private.{" "}
                      <strong>
                        If you lose this, and other required shares are lost,
                        the secret may be unrecoverable.
                      </strong>
                    </li>
                    {primaryRecipientShare && (
                      <li>
                        <strong>
                          Primary Recipient's Share (Share 3 of {sssSharesTotal}
                          ):
                        </strong>{" "}
                        Displayed below as `Share #2`. This is for{" "}
                        {recipientName || "your primary recipient"}. You MUST
                        send this to them.
                      </li>
                    )}
                    {additionalDistributableShares.length > 0 && (
                      <li>
                        <strong>
                          Additional Distributable Shares (Shares 4 to{" "}
                          {sssSharesTotal} of {sssSharesTotal}):
                        </strong>{" "}
                        Displayed below as `Share #3` onwards. You are
                        responsible for securely distributing these additional
                        shares.
                      </li>
                    )}
                  </>
                )}
              </ul>
            </AlertDescription>
          </Alert>

          <Separator />

          {userManagedShares.map((shareHex, index) => {
            let shareName = ""
            const trueShareNumber = index + 2

            if (isMinimalShares) {
              // Only one share for recipient in 2-share scenario
              shareName = `Recipient's (${recipientName || "N/A"}) Share`
            } else {
              // 3+ share scenario
              if (index === 0) {
                shareName = "Your Personal Share"
              } else if (index === 1) {
                shareName = `Primary Recipient's (${recipientName || "N/A"}) Share`
              } else {
                shareName = "Additional Distributable Share"
              }
            }

            return (
              <div key={`share-display-${index}`} className="space-y-6">
                {index > 0 && <Separator />}
                <ShareDisplay
                  shareHex={shareHex}
                  shareNumber={trueShareNumber}
                  shareName={shareName}
                />
              </div>
            )
          })}

          <Separator />

          <Alert variant="destructive" className="mt-6">
            <AlertTriangle className="mt-0.5 h-5 w-5" />
            <AlertTitle className="text-lg">
              CRITICAL: Securely Distribute Shares!
            </AlertTitle>
            <AlertDescription className="text-foreground space-y-3">
              <p>
                For this system to work, you <strong>MUST</strong> take the
                following actions:
              </p>
              <ul className="list-disc space-y-1 pl-6">
                {isMinimalShares ? (
                  <li>
                    <strong>Recipient's Share:</strong> Securely send this to{" "}
                    {recipientName || "your designated recipient"} (
                    {recipientEmail || "their contact details"}). This is the
                    only share you need to distribute - KeyFate will
                    automatically provide its share when needed.
                  </li>
                ) : (
                  <>
                    <li>
                      <strong>Your Personal Share:</strong> Keep this share
                      extremely safe and private.
                    </li>
                    {primaryRecipientShare && (
                      <li>
                        <strong>Primary Recipient's:</strong> Securely send this
                        to{" "}
                        {recipientName || "your designated primary recipient"} (
                        {recipientEmail || "their contact details"}).
                      </li>
                    )}
                    {additionalDistributableShares.length > 0 && (
                      <li>
                        <strong>
                          Additional Distributable Shares (Display #3 onwards):
                        </strong>{" "}
                        Securely send these to their intended recipients. You
                        are responsible for their distribution.
                      </li>
                    )}
                  </>
                )}
              </ul>
              <p>
                Without the necessary shares, recipients will NOT be able to
                recover the secret even if KeyFate sends its share.
              </p>
              <p>
                <strong>How to send shares securely:</strong>
              </p>
              <ul className="list-disc space-y-1 pl-6">
                <li>Use a secure messaging app with end-to-end encryption.</li>
                <li>
                  Encrypt them in a file and share the file + password
                  separately.
                </li>
                <li>Provide them in person.</li>
                <li>
                  If you use the email button below (for the primary recipient),
                  ensure their email is secure.
                </li>
              </ul>
              {recipientShareMailto && primaryRecipientShare && (
                <Button asChild variant="destructive" className="mt-2 w-full">
                  <a
                    href={recipientShareMailto}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    Email Primary Recipient's Share to{" "}
                    {recipientName || recipientEmail}
                  </a>
                </Button>
              )}
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
              {isMinimalShares
                ? "I have securely sent the recipient's share as instructed and understand its importance."
                : "I have securely distributed all necessary shares as instructed and understand their importance."}
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
              : isMinimalShares
                ? "Confirm Share Sent to Proceed"
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
