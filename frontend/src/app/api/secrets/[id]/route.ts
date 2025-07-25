import { createClient } from "@/utils/supabase/server";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: secret, error } = await supabase
      .from("secrets")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !secret) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 });
    }

    return NextResponse.json(secret);
  } catch (error) {
    console.error("Error fetching secret:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// Schema for updating secret metadata
const updateSecretSchema = z.object({
  title: z.string().min(1, "Title is required"),
  recipient_name: z.string().min(1, "Recipient name is required"),
  recipient_email: z.string().email().optional().or(z.literal("")),
  recipient_phone: z.string().optional().or(z.literal("")),
  contact_method: z.enum(["email", "phone", "both"]),
  check_in_days: z.number().min(1).max(365),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateSecretSchema.parse(body);

    const { data: secret, error: updateError } = await supabase
      .from("secrets")
      .update(validatedData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating secret:", updateError);
      return NextResponse.json(
        { error: "Failed to update secret" },
        { status: 500 },
      );
    }

    return NextResponse.json(secret);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid data", details: error.errors },
        { status: 400 },
      );
    }

    console.error("Error updating secret:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First verify the secret exists and belongs to the user
    const { data: secret, error: fetchError } = await supabase
      .from("secrets")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !secret) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 });
    }

    // Delete the secret (RLS policies ensure user can only delete their own secrets)
    const { error: deleteError } = await supabase
      .from("secrets")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) {
      console.error("Error deleting secret:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete secret" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting secret:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
