import { SssDecryptor } from "@/components/sss-decryptor"
import { Suspense } from "react"

// TODO: Implement parsing of initial shares from URL query params if needed
// For example: ?share1=xxxx&share2=yyyy
// const initialSharesFromQuery = (searchParams?: { [key: string]: string | string[] | undefined }) => {
//   if (!searchParams) return [];
//   const shares: string[] = [];
//   if (searchParams.share1 && typeof searchParams.share1 === 'string') shares.push(searchParams.share1);
//   if (searchParams.share2 && typeof searchParams.share2 === 'string') shares.push(searchParams.share2);
//   // Add more share params if necessary
//   return shares;
// };

export default function DecryptPage(/*{ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }*/) {
  // const initialShares = initialSharesFromQuery(searchParams);

  return (
    <div className="container mx-auto min-h-screen px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <Suspense
          fallback={
            <div className="text-center text-lg">Loading Decryptor...</div>
          }
        >
          {/* <SssDecryptor initialShares={initialShares} /> */}
          <SssDecryptor />{" "}
          {/* For now, not passing initial shares from query params */}
        </Suspense>
      </div>
    </div>
  )
}
