import "./globals.css"
import { Inter } from "next/font/google"
import { Toaster } from "@/components/ui/toaster"
import { ThemeProvider } from "@/components/theme-provider"
import { SessionProvider } from "@/components/session-provider"
import { ConfigProvider } from "@/contexts/ConfigContext"
import { Metadata } from "next"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "KeyFate",
  description: "Your key to peace of mind",
}

// Prevent static generation for all pages due to SessionProvider
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-background min-h-screen`}>
        <SessionProvider>
          <ConfigProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="system"
              enableSystem
              disableTransitionOnChange
            >
              <main>{children}</main>
              <Toaster />
            </ThemeProvider>
          </ConfigProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
