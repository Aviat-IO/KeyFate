import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { secretSchema } from "@/lib/schemas/secret";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = secretSchema.parse(body);

    const { data, error } = await supabase
      .from("secrets")
      .insert({
        ...validatedData,
        user_id: user.user.id,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating secret:", error);
      return NextResponse.json(
        { error: "Failed to create secret" },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in POST /api/secrets:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
