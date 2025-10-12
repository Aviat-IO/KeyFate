import { encryptMessage } from "@/lib/encryption"
import { NextRequest, NextResponse } from "next/server"

// Prevent static analysis during build
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json()

    if (!message || message === "") {
      return NextResponse.json(
        { error: "Missing message to encrypt" },
        { status: 400 },
      )
    }

    const result = await encryptMessage(message)

    return NextResponse.json({
      encryptedMessage: result.encrypted,
      iv: result.iv,
      authTag: result.authTag,
    })
  } catch (error) {
    console.error("Encryption error:", error)
    return NextResponse.json({ error: "Encryption failed" }, { status: 500 })
  }
}
