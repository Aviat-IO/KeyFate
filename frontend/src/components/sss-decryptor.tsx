"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import { useConfig } from "@/contexts/ConfigContext"
import { Buffer } from "buffer"
import {
  Check,
  Copy,
  Info,
  PlusCircle,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import sss from "shamirs-secret-sharing"

type SssDecryptorProps = {
  initialShares?: string[]
}

export function SssDecryptor({ initialShares = [] }: SssDecryptorProps) {
  const { toast } = useToast()
  const { config } = useConfig()
  const firstTextareaRef = useRef<HTMLTextAreaElement>(null)
  const secondTextareaRef = useRef<HTMLTextAreaElement>(null)

  const [shares, setShares] = useState<string[]>(() => {
    // Initialize with at least two empty strings if no initial shares, or fill with initialShares
    const defaults = ["", ""]
    if (initialShares.length === 0) return defaults
    if (initialShares.length === 1) return [initialShares[0], ""]
    return initialShares
  })
  const [recoveredSecret, setRecoveredSecret] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  // Focus the appropriate textarea when component mounts
  useEffect(() => {
    if (shares[0] && shares[0].trim() !== "" && secondTextareaRef.current) {
      // If first share is filled, focus on second textarea
      secondTextareaRef.current.focus()
    } else if (firstTextareaRef.current) {
      // If first share is empty, focus on first textarea
      firstTextareaRef.current.focus()
    }
  }, [shares])

  const handleShareChange = (index: number, value: string) => {
    const newShares = [...shares]
    newShares[index] = value.trim()
    setShares(newShares)
    setRecoveredSecret(null) // Clear previous result when shares change
    setError(null)
  }

  const addShareInput = () => {
    setShares([...shares, ""])
  }

  const removeShareInput = (index: number) => {
    if (shares.length <= 2) {
      setError("You need at least two shares to attempt recovery.")
      return
    }
    const newShares = shares.filter((_, i) => i !== index)
    setShares(newShares)
  }

  const handleCombineShares = () => {
    setIsLoading(true)
    setError(null)
    setRecoveredSecret(null)

    const validShares = shares.filter((s) => s.trim() !== "")
    if (validShares.length < 2) {
      setError("Please provide at least two shares.")
      setIsLoading(false)
      return
    }

    try {
      const shareBuffers = validShares.map((shareHex) => {
        if (!/^[0-9a-fA-F]+$/.test(shareHex)) {
          throw new Error(
            `Invalid share format: "${shareHex.substring(0, 10)}...". Shares should be hexadecimal strings.`,
          )
        }
        // Ensure hex string has an even length for Buffer.from(..., \'hex\')
        const sanitizedHex =
          shareHex.length % 2 !== 0 ? "0" + shareHex : shareHex
        if (sanitizedHex.length === 0) {
          throw new Error("Empty share provided after sanitization.")
        }
        return Buffer.from(sanitizedHex, "hex")
      })

      // Basic validation: Check if all buffers have the same length (SSS requirement)
      if (shareBuffers.length > 1) {
        const firstLength = shareBuffers[0].length
        if (!shareBuffers.every((b) => b.length === firstLength)) {
          throw new Error(
            "Shares are not of the same length. Ensure you have copied them correctly.",
          )
        }
      }

      const recovered = sss.combine(shareBuffers)
      setRecoveredSecret(recovered.toString("utf8"))
    } catch (e) {
      console.error("Error combining shares:", e)
      setError(
        `Failed to recover secret: ${e.message || "Invalid shares or threshold not met."}. Ensure shares are correct, in hexadecimal format, and you have enough of them.`,
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopySecret = async () => {
    if (!recoveredSecret) return

    try {
      await navigator.clipboard.writeText(recoveredSecret)
      setIsCopied(true)
      toast({
        title: "Copied!",
        description: "Secret copied to clipboard successfully.",
        duration: 3000,
      })

      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setIsCopied(false)
      }, 2000)
    } catch (error) {
      console.error("Error copying secret:", error)
      toast({
        title: "Copy failed",
        description: "Failed to copy secret to clipboard.",
        variant: "destructive",
        duration: 3000,
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="mb-4 text-3xl font-bold">Secret Recovery</h1>
      </div>

      <div className="space-y-6 rounded-lg border p-6 shadow-md">
        <div>
          <h2 className="mb-2 text-xl font-semibold">Enter Your Shares</h2>
          <p className="text-muted-foreground text-sm">
            Enter your {config?.company || "KeyFate"} shares below. You need a minimum
            number of correct shares (as per the threshold set during creation)
            to recover the original secret (shares are typically hexadecimal
            strings).
          </p>
        </div>

        <div className="space-y-4">
          {shares.map((share, index) => (
            <div key={index} className="flex items-center space-x-2">
              <Textarea
                ref={
                  index === 0
                    ? firstTextareaRef
                    : index === 1
                      ? secondTextareaRef
                      : undefined
                }
                placeholder={`Share ${index + 1} (from ${config?.company || "KeyFate"} or your trusted contact)`}
                value={share}
                onChange={(e) => handleShareChange(index, e.target.value)}
                rows={2}
                className="flex-grow font-mono text-sm"
                disabled={isLoading}
              />
              {shares.length > 2 && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeShareInput(index)}
                  disabled={isLoading}
                  aria-label="Remove share"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addShareInput}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            <PlusCircle className="mr-2 h-4 w-4" /> Add Another Share
          </Button>
        </div>

        <Button
          type="button"
          onClick={handleCombineShares}
          disabled={
            isLoading || shares.filter((s) => s.trim() !== "").length < 2
          }
          className="w-full text-lg"
          size="lg"
        >
          {isLoading ? "Recovering..." : "Recover Secret"}
        </Button>

        {error && (
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Recovery Failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {recoveredSecret && (
          <Alert
            variant="default"
            className="border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/30"
          >
            <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertTitle className="text-green-700 dark:text-green-300">
              Secret Recovered Successfully!
            </AlertTitle>
            <AlertDescription className="space-y-2">
              <p className="text-green-800 dark:text-green-200">
                Your original secret is:
              </p>
              <Textarea
                value={recoveredSecret}
                readOnly
                rows={4}
                className="bg-muted mt-2 w-full select-all rounded-md border p-3 font-mono text-sm"
              />
              <Button
                type="button"
                variant={isCopied ? "default" : "outline"}
                size="sm"
                className={`mt-2 transition-all duration-200 ${
                  isCopied
                    ? "border-green-600 bg-green-600 text-white hover:bg-green-700"
                    : ""
                }`}
                onClick={handleCopySecret}
                disabled={isCopied}
              >
                {isCopied ? (
                  <>
                    <Check className="mr-2 h-3 w-3" /> Copied!
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-3 w-3" /> Copy Recovered Secret
                  </>
                )}
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="border-muted bg-muted/30 rounded-lg border p-4">
        <div className="flex items-start space-x-3">
          <Info className="text-muted-foreground mt-0.5 h-4 w-4" />
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              <strong>Educational demonstration:</strong> This tool runs
              entirely in your browser. Your shares are processed locally and
              never sent to servers. For maximum security with sensitive
              secrets, we recommend running this tool locally on your own
              device.
            </p>
            <Button
              variant="link"
              size="sm"
              asChild
              className="text-muted-foreground h-auto p-0 text-xs underline"
            >
              <Link href="/local-instructions">
                Get setup instructions for local use →
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
