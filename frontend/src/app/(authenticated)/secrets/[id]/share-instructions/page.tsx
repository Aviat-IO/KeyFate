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
  const [recipients, setRecipients] = useState<Array<{name: string, email?: string | null}>>([])
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

    let parsedRecipients: Array<{name: string, email?: string | null}> = []
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
  const primaryRecipient = recipients.find(r => r) || null
  
  const getRecipientShareInfo = () => {
    if (isMinimalShares) {
      return recipients.map((recipient, idx) => ({
        recipient,
        share: userManagedShares[idx] || null,
        shareNumber: idx + 2
      }))
    } else {
      return recipients.map((recipient, idx) => ({
        recipient,
        share: userManagedShares[idx + 1] || null,
        shareNumber: idx + 3
      }))
    }
  }

  const recipientSharesInfo = getRecipientShareInfo()
  
  const createMailto = (recipient: {name: string, email?: string | null}, share: string) => {
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
                  <strong>
                    KeyFate's Share (Share 1 of {sssSharesTotal}):
                  </strong>{" "}
                  We securely store one share. This share alone cannot reveal
                  your secret. It will be sent to your recipients if you miss your
                  check-ins.
                </li>
                {isMinimalShares ? (
                  <li>
                    <strong>
                      Recipient Shares (Shares 2-{sssSharesTotal} of {sssSharesTotal}):
                    </strong>{" "}
                    Displayed below. Each recipient gets one share. You MUST send
                    these to them. With only {sssSharesTotal} shares total, both KeyFate's share
                    and the recipient shares are required to recover the secret.
                  </li>
                ) : (
                  <>
                    <li>
                      <strong>
                        Your Personal Share (Share 2 of {sssSharesTotal}):
                      </strong>{" "}
                      Displayed below as the first share in the list.
                      Keep this share extremely safe and private.{" "}
                      <strong>
                        If you lose this, and other required shares are lost,
                        the secret may be unrecoverable.
                      </strong>
                    </li>
                    <li>
                      <strong>
                        Recipient Shares (Shares 3-{sssSharesTotal} of {sssSharesTotal}):
                      </strong>{" "}
                      Displayed below. Each recipient gets one share. You MUST
                      send these to them securely.
                    </li>
                  </>
                )}
              </ul>
            </AlertDescription>
          </Alert>

          <Separator />

          {!isMinimalShares && userManagedShares[0] && (
            <>
              <ShareDisplay
                shareHex={userManagedShares[0]}
                shareNumber={2}
                shareName="Your Personal Share"
              />
              <Separator />
            </>
          )}

          {recipientSharesInfo.map((info, index) => (
            <div key={`recipient-${index}`} className="space-y-6">
              {index > 0 && <Separator />}
              <div className="space-y-2">
                <ShareDisplay
                  shareHex={info.share}
                  shareNumber={info.shareNumber}
                  shareName={`${info.recipient.name}'s Share`}
                />
                {info.recipient.email && info.share && (
                  <Button 
                    asChild 
                    variant="outline" 
                    className="w-full"
                  >
                    <a
                      href={createMailto(info.recipient, info.share) || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Send className="mr-2 h-4 w-4" />
                      Email to {info.recipient.name}
                    </a>
                  </Button>
                )}
              </div>
            </div>
          ))}

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
                {!isMinimalShares && (
                  <li>
                    <strong>Your Personal Share:</strong> Keep this share
                    extremely safe and private.
                  </li>
                )}
                {recipientSharesInfo.map((info, idx) => (
                  <li key={`instruction-${idx}`}>
                    <strong>{info.recipient.name}'s Share:</strong> Securely send this to{" "}
                    {info.recipient.name} ({info.recipient.email || "their contact"}).
                  </li>
                ))}
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
                  If you use the email buttons above, ensure the recipients' 
                  email accounts are secure.
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
              I have securely distributed all necessary shares as instructed and understand their importance.
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
