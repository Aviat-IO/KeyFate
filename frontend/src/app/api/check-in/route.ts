// import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
// import { cookies } from "next/headers";
// import { NextResponse } from "next/server";
// import type { Database } from "@/lib/database.types";

// export async function POST() {
//   try {
//     const cookieStore = await cookies();
//     const supabase = createRouteHandlerClient<Database>({
//       // @ts-expect-error
//       cookies: () => cookieStore,
//     });

//     const {
//       data: { user },
//       error: userError,
//     } = await supabase.auth.getUser();
//     if (userError || !user) {
//       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//     }

//     // Get user's active secrets
//     const { data: secrets, error: secretsError } = await supabase
//       .from("secrets")
//       .select("*")
//       .eq("user_id", user.id);

//     if (secretsError) {
//       console.error("[POST /api/check-in] Secrets error:", secretsError);
//       return NextResponse.json(
//         { error: "Failed to fetch secrets" },
//         { status: 500 },
//       );
//     }

//     // Update check-in time for all active secrets
//     const now = new Date();
//     const updates = secrets.map((secret) => {
//       const nextCheckIn = new Date(now);
//       nextCheckIn.setDate(nextCheckIn.getDate() + secret.check_in_days);

//       return supabase
//         .from("secrets")
//         .update({
//           last_check_in: now.toISOString(),
//           next_check_in: nextCheckIn.toISOString(),
//         })
//         .eq("id", secret.id);
//     });

//     await Promise.all(updates);

//     return NextResponse.json({ success: true });
//   } catch (error) {
//     console.error("[POST /api/check-in] Error:", error);
//     return NextResponse.json(
//       { error: "Internal Server Error" },
//       { status: 500 },
//     );
//   }
// }
