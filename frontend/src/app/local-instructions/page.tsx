"use client"

import { Footer } from "@/components/footer"
import { NavBar } from "@/components/nav-bar"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Check, Copy, Download, Shield, Terminal } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

function CodeBlock({
  code,
  language = "bash",
}: {
  code: string
  language?: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Simple syntax highlighting for JavaScript
  const highlightJavaScript = (code: string) => {
    return code
      .replace(
        /(import|from|const|let|var|function|return|console\.log)/g,
        '<span class="text-primary-foreground">$1</span>',
      )
      .replace(/('.*?'|`.*?`)/g, '<span class="text-accent-foreground">$1</span>')
      .replace(/(\/\/.*$)/gm, '<span class="text-muted-foreground">$1</span>')
  }

  return (
    <div className="bg-muted relative rounded-lg border">
      <div className="relative">
        {language === "javascript" ? (
          <code
            className="bg-background block overflow-x-auto whitespace-pre-line rounded p-4 font-mono text-sm"
            dangerouslySetInnerHTML={{ __html: highlightJavaScript(code) }}
          />
        ) : (
          <code className="bg-background block overflow-x-auto whitespace-pre-line rounded p-4 font-mono text-sm">
            {code}
          </code>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="bg-background/80 hover:bg-background absolute right-2 top-2 h-8 w-8 border"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-4 w-4 text-accent-foreground" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}

export default function LocalInstructionsPage() {
  return (
    <div className="bg-background min-h-screen">
      <div className="bg-background/90 supports-[backdrop-filter]:bg-background/50 sticky top-0 z-50 border-b backdrop-blur">
        <NavBar />
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 text-center">
            <h1 className="mb-4 text-4xl font-bold">
              Run Secret Sharing Tool Locally
            </h1>
            <p className="text-muted-foreground text-xl">
              For maximum security and privacy, run the Shamir's Secret Sharing
              tool on your own device
            </p>
          </div>

          <Alert className="mb-8">
            <Shield className="h-4 w-4" />
            <AlertTitle>Why Run Locally?</AlertTitle>
            <AlertDescription>
              While our online tool runs entirely in your browser (client-side),
              running the tool locally provides absolute certainty that your
              shares never leave your device and aren't visible to any third
              party, including network monitoring.
            </AlertDescription>
          </Alert>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Download className="mr-2 h-5 w-5" />
                  Option 1: Download Our Source Code
                </CardTitle>
                <CardDescription>
                  Get the exact same tool that powers this website
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium">
                    Clone the repository:
                  </p>
                  <CodeBlock code="git clone https://github.com/accolver/dead-mans-switch.git" />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">
                    Navigate to frontend and install:
                  </p>
                  <CodeBlock code="cd dead-mans-switch/frontend && pnpm install" />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">Run locally:</p>
                  <CodeBlock code="pnpm dev" />
                </div>
                <p className="text-muted-foreground text-sm">
                  Then visit{" "}
                  <code className="bg-muted rounded px-1 py-0.5 text-xs">
                    http://localhost:3000/decrypt
                  </code>{" "}
                  to use the tool completely offline.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Terminal className="mr-2 h-5 w-5" />
                  Option 2: Use the Core Library Directly
                </CardTitle>
                <CardDescription>
                  Use the same shamirs-secret-sharing library we use
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="mb-2 text-sm font-medium">
                    Install the library:
                  </p>
                  <CodeBlock code="npm install shamirs-secret-sharing" />
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">
                    Basic usage example:
                  </p>
                  <CodeBlock
                    language="javascript"
                    code={`import sss from 'shamirs-secret-sharing'

const secret = Buffer.from('secret key')
const shares = sss.split(secret, { shares: 3, threshold: 2 })
const recovered = sss.combine(shares.slice(0, 2))

console.log(recovered.toString()) // 'secret key'`}
                  />
                </div>
                <p className="text-muted-foreground text-sm">
                  View the full documentation at{" "}
                  <Link
                    href="https://github.com/jwerle/shamirs-secret-sharing"
                    className="text-primary hover:underline"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    github.com/jwerle/shamirs-secret-sharing
                  </Link>
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Air-Gapped Security Setup</CardTitle>
              <CardDescription>
                For the highest level of security when dealing with extremely
                sensitive secrets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ol className="list-decimal space-y-2 pl-6">
                <li>Download the source code on a connected computer</li>
                <li>
                  Transfer the code to an air-gapped (offline) computer via USB
                </li>
                <li>
                  Install dependencies and run the tool on the offline computer
                </li>
                <li>Input your secret and generate shares offline</li>
                <li>Distribute shares through secure, separate channels</li>
              </ol>
              <Alert>
                <AlertDescription>
                  This approach ensures your secret never touches any
                  network-connected device.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>

          <div className="mt-8 text-center">
            <Button asChild>
              <Link href="/decrypt">
                Try the Online Tool (Educational Purposes)
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
