"use client"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="mb-4 text-4xl font-bold">Something went wrong!</h1>
      <p className="text-muted-foreground mb-4">
        {error.message || "An unexpected error occurred"}
      </p>
      <button
        onClick={reset}
        className="bg-primary hover:bg-primary rounded px-4 py-2 text-white"
      >
        Try again
      </button>
    </div>
  )
}
