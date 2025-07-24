"use client"

import { Footer } from "@/components/footer"
import { NavBar } from "@/components/nav-bar"
import { SssDecryptor } from "@/components/sss-decryptor"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function DecryptContent() {
  const searchParams = useSearchParams()

  // Extract shares from query parameters (share1, share2, share3, etc.)
  const extractSharesFromParams = () => {
    const shares: string[] = []
    let shareIndex = 1

    while (true) {
      const shareValue = searchParams.get(`share${shareIndex}`)
      if (shareValue) {
        shares.push(shareValue)
        shareIndex++
      } else {
        break
      }
    }

    return shares
  }

  const initialShares = extractSharesFromParams()

  return (
    <div className="w-full max-w-2xl">
      <SssDecryptor initialShares={initialShares} />
    </div>
  )
}

export default function DecryptPage() {
  return (
    <div className="bg-background min-h-screen">
      <div className="bg-background/90 supports-[backdrop-filter]:bg-background/50 sticky top-0 z-50 border-b backdrop-blur">
        <NavBar />
      </div>

      <div className="container mx-auto flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <Suspense
          fallback={
            <div className="text-center text-lg">Loading Decryptor...</div>
          }
        >
          <DecryptContent />
        </Suspense>
      </div>

      <Footer />
    </div>
  )
}
