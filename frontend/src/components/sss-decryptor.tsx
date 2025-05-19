"use client"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Buffer } from "buffer"
import {
  Copy,
  PlusCircle,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react"
import { useState } from "react"
import sss from "shamirs-secret-sharing"

type SssDecryptorProps = {
  initialShares?: string[]
}

export function SssDecryptor({ initialShares = [] }: SssDecryptorProps) {
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

  return (
    <div className="space-y-6 rounded-lg border p-6 shadow-md">
      <h2 className="text-2xl font-semibold">Recover Secret with Shares</h2>
      <p className="text-muted-foreground">
        Enter your Shamir\'s Secret Sharing shares below. You need a minimum
        number of correct shares (as per the threshold set during creation) to
        recover the original secret. Shares are typically hexadecimal strings.
      </p>

      <div className="space-y-4">
        {shares.map((share, index) => (
          <div key={index} className="flex items-center space-x-2">
            <Textarea
              placeholder={`Share ${index + 1} (hexadecimal format)`}
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
        disabled={isLoading || shares.filter((s) => s.trim() !== "").length < 2}
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
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => navigator.clipboard.writeText(recoveredSecret)}
            >
              <Copy className="mr-2 h-3 w-3" /> Copy Recovered Secret
            </Button>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
