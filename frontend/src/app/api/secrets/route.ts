import { encryptMessage } from "@/lib/encryption";
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const cookieStore = await cookies();
    // @ts-expect-error
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 },
      );
    }

    const body = await req.json();
    console.log("body", body);
    const {
      title,
      message,
      recipient_name,
      recipient_email,
      recipient_phone,
      contact_method,
      check_in_days,
    } = body;

    // Calculate next check-in time
    const nextCheckIn = new Date();
    nextCheckIn.setDate(nextCheckIn.getDate() + parseInt(check_in_days));
    console.log("nextCheckIn", nextCheckIn);

    // Encrypt the message
    const { encrypted, iv, authTag } = await encryptMessage(message);
    console.log("encrypted", encrypted);
    console.log("iv", iv);
    console.log("authTag", authTag);

    // Store the secret
    const { error: insertError } = await supabase.from("secrets").insert([
      {
        user_id: user.id,
        title,
        message: encrypted,
        recipient_name,
        recipient_email: contact_method !== "phone" ? recipient_email : null,
        recipient_phone: contact_method !== "email" ? recipient_phone : null,
        contact_method,
        check_in_days,
        next_check_in: nextCheckIn.toISOString(),
        iv,
        auth_tag: authTag,
      },
    ]);
    console.log("insertError", insertError);

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CreateSecret] Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error
          ? error.message
          : "Failed to create secret",
      },
      { status: 500 },
    );
  }
}
