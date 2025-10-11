"use client"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold mb-4">Something went wrong!</h1>
      <p className="text-muted-foreground mb-4">{error.message || "An unexpected error occurred"}</p>
      <button
        onClick={reset}
        className="px-4 py-2 bg-primary text-white rounded hover:bg-primary"
      >
        Try again
      </button>
    </div>
  )
}