import { Suspense } from "react"
import { CheckInClient } from "./check-in-client"

export default function CheckInPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CheckInClient />
    </Suspense>
  )
}
