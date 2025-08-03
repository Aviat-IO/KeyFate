"use client"

import { NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY } from "@/lib/env"

export default function TestEnvPage() {
  return (
    <div className="container mx-auto p-8 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Environment Variables Test</h1>

      <div className="space-y-4">
        <div className="p-4 border rounded-lg">
          <h2 className="font-semibold mb-2">Stripe Publishable Key:</h2>
          <p className="font-mono text-sm break-all">
            {NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "NOT SET"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?
              `Key type: ${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.startsWith('pk_test_') ? 'TEST' : 'LIVE'}` :
              "No key found"
            }
          </p>
        </div>

        <div className="p-4 border rounded-lg">
          <h2 className="font-semibold mb-2">All Environment Variables:</h2>
          <pre className="text-sm bg-muted p-2 rounded overflow-auto">
            {JSON.stringify({
              NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?
                `${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.substring(0, 20)}...` :
                'NOT SET',
              NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
              NODE_ENV: process.env.NODE_ENV,
            }, null, 2)}
          </pre>
        </div>

        <div className="p-4 border rounded-lg">
          <h2 className="font-semibold mb-2">Browser Console Test:</h2>
          <p className="text-sm text-muted-foreground">
            Open browser console (F12) and check for any Stripe-related errors.
          </p>
          <button
            onClick={() => {
              console.log('Stripe key in console:', NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
              console.log('All env vars:', {
                NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
                NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
                NODE_ENV: process.env.NODE_ENV,
              });
            }}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Log to Console
          </button>
        </div>
      </div>
    </div>
  )
}
