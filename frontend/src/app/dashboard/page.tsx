import { NavBar } from "@/components/nav-bar";
import { Button } from "@/components/ui/button";
import type { Database } from "@/lib/database.types";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { AlertCircle, Clock, PlusCircle } from "lucide-react";
import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckInButton } from "@/components/check-in-button";

export const dynamic = "force-dynamic";

interface Secret {
  id: string;
  title: string;
  recipient_name: string;
  status: "active" | "paused" | "triggered";
  next_check_in: string;
}

export default async function DashboardPage() {
  const cookieStore = cookies();
  const supabase = createServerComponentClient<Database>({
    cookies: () => cookieStore,
  });

  try {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("[DashboardPage] Auth error:", userError);
      redirect("/auth/login");
    }

    // Fetch secrets directly using Supabase client
    const { data: secrets, error: secretsError } = await supabase
      .from("secrets")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (secretsError) {
      console.error("[DashboardPage] Secrets error:", secretsError);
      throw new Error("Failed to fetch secrets");
    }

    return (
      <div className="bg-background min-h-screen">
        <NavBar user={user} />
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Keep your secrets safe by checking in regularly
              </p>
            </div>
            <div className="flex items-center gap-4">
              <CheckInButton />
              <Button asChild>
                <Link href="/secrets/new">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Create New Secret
                </Link>
              </Button>
            </div>
          </div>

          {!secrets || secrets.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed p-12 text-center">
              <div className="mx-auto max-w-sm">
                <AlertCircle className="text-muted-foreground mx-auto h-12 w-12" />
                <h2 className="mt-4 text-lg font-semibold">No secrets yet</h2>
                <p className="text-muted-foreground mt-2 text-sm">
                  Create your first dead man's switch secret to get started.
                  Your secret will only be revealed if you fail to check in.
                </p>
                <Button asChild className="mt-4">
                  <Link href="/secrets/new">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Your First Secret
                  </Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {secrets.map((secret: Secret) => (
                <div
                  key={secret.id}
                  className="bg-card rounded-lg border p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{secret.title}</h3>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/secrets/${secret.id}/edit`}>Edit</Link>
                    </Button>
                  </div>
                  <p className="text-muted-foreground mt-2 text-sm">
                    For: {secret.recipient_name}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-muted-foreground flex items-center text-sm">
                      <Clock className="mr-1 h-4 w-4" />
                      Next check-in:{" "}
                      {new Date(secret.next_check_in).toLocaleDateString()}
                    </div>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        secret.status === "active"
                          ? "bg-green-100 text-green-700"
                          : secret.status === "paused"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                      }`}
                    >
                      {secret.status.charAt(0).toUpperCase() +
                        secret.status.slice(1)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  } catch (error) {
    console.error("[DashboardPage] Error:", error);
    redirect("/auth/login");
  }
}
