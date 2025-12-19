import { Footer } from "@/components/footer"
import { NavBar } from "@/components/nav-bar"
import { Metadata } from "next"

// Override root layout's force-dynamic to enable static generation for blog
export const dynamic = "force-static"
export const revalidate = 3600 // Revalidate every hour

export const metadata: Metadata = {
  title: {
    template: "%s | KeyFate Blog",
    default: "KeyFate Blog - Digital Security & Estate Planning",
  },
  description:
    "Learn about digital security, cryptocurrency protection, estate planning, and how to use a dead man's switch to protect your most important information.",
}

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="bg-background min-h-screen">
      <div className="bg-background/90 supports-[backdrop-filter]:bg-background/50 sticky top-0 z-50 border-b backdrop-blur">
        <NavBar />
      </div>
      {children}
      <Footer />
    </div>
  )
}
