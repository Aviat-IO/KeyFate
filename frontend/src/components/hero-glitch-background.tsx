"use client"

import LetterGlitch from "@/components/ui/letter-glitch"

export function HeroGlitchBackground() {
  return (
    <div className="absolute inset-0 h-full w-full">
      <LetterGlitch
        glitchColors={["#ef4444", "#dc2626", "#b91c1c", "#991b1b"]}
        glitchSpeed={80}
        centerVignette={true}
        outerVignette={true}
        smooth={true}
      />
    </div>
  )
}
