import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { secretSchema } from "@/lib/schemas/secret";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient();

    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: secret, error } = await supabase
      .from("secrets")
      .select("*")
      .eq("id", params.id)
      .eq("user_id", user.user.id)
      .single();

    if (error) {
      console.error("Error fetching secret:", error);
      return NextResponse.json(
        { error: "Secret not found" },
        { status: 404 },
      );
    }

    return NextResponse.json(secret);
  } catch (error) {
    console.error("Error in GET /api/secrets/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
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
      .update(validatedData)
      .eq("id", params.id)
      .eq("user_id", user.user.id)
      .select()
      .single();

    if (error) {
      console.error("Error updating secret:", error);
      return NextResponse.json(
        { error: "Failed to update secret" },
        { status: 500 },
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error in PUT /api/secrets/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient();

    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("secrets")
      .delete()
      .eq("id", params.id)
      .eq("user_id", user.user.id);

    if (error) {
      console.error("Error deleting secret:", error);
      return NextResponse.json(
        { error: "Failed to delete secret" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in DELETE /api/secrets/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
