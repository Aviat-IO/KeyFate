"use client";

import { NavBar } from "@/components/nav-bar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { AlertCircle } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface FormData {
  title: string;
  message: string;
  recipient_name: string;
  recipient_email: string;
  recipient_phone: string;
  contact_method: "email" | "phone" | "both";
  check_in_interval: string; // days
}

export default function EditSecretPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClientComponentClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    title: "",
    message: "",
    recipient_name: "",
    recipient_email: "",
    recipient_phone: "",
    contact_method: "email",
    check_in_interval: "7",
  });

  useEffect(() => {
    async function loadSecret() {
      try {
        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) throw new Error("Not authenticated");

        const { data: secret, error: secretError } = await supabase
          .from("secrets")
          .select("*")
          .eq("id", params.id)
          .eq("user_id", user.id)
          .single();

        if (secretError) throw secretError;
        if (!secret) throw new Error("Secret not found");

        // Convert interval to days for the form
        const intervalMatch = secret.check_in_interval.match(/(\d+) days/);
        const days = intervalMatch ? intervalMatch[1] : "7";

        setFormData({
          title: secret.title,
          message: secret.message,
          recipient_name: secret.recipient_name,
          recipient_email: secret.recipient_email || "",
          recipient_phone: secret.recipient_phone || "",
          contact_method: secret.contact_method,
          check_in_interval: days,
        });
      } catch (error) {
        console.error("Error loading secret:", error);
        setError(
          error instanceof Error ? error.message : "Failed to load secret",
        );
      } finally {
        setLoading(false);
      }
    }

    loadSecret();
  }, [supabase, params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Not authenticated");

      // Calculate next check-in time
      const nextCheckIn = new Date();
      nextCheckIn.setDate(
        nextCheckIn.getDate() + parseInt(formData.check_in_interval),
      );

      const { error: updateError } = await supabase
        .from("secrets")
        .update({
          title: formData.title,
          message: formData.message,
          recipient_name: formData.recipient_name,
          recipient_email:
            formData.contact_method !== "phone"
              ? formData.recipient_email
              : null,
          recipient_phone:
            formData.contact_method !== "email"
              ? formData.recipient_phone
              : null,
          contact_method: formData.contact_method,
          check_in_interval: `${formData.check_in_interval} days`,
          next_check_in: nextCheckIn.toISOString(),
        })
        .eq("id", params.id)
        .eq("user_id", user.id);

      if (updateError) throw updateError;

      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Error updating secret:", error);
      setError(
        error instanceof Error ? error.message : "Failed to update secret",
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-background min-h-screen">
        <NavBar />
        <div className="container mx-auto px-4 py-8">
          <h1 className="mb-8 text-2xl font-bold">Loading...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-background min-h-screen">
      <NavBar />
      <div className="container mx-auto px-4 py-8">
        <h1 className="mb-8 text-2xl font-bold">Edit Secret</h1>
        <div className="mx-auto max-w-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Secret Title</label>
              <Input
                required
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="E.g., Important Documents Location"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Secret Message</label>
              <Textarea
                required
                value={formData.message}
                onChange={(e) =>
                  setFormData({ ...formData, message: e.target.value })
                }
                placeholder="Your secret message that will be revealed..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Recipient's Name</label>
              <Input
                required
                value={formData.recipient_name}
                onChange={(e) =>
                  setFormData({ ...formData, recipient_name: e.target.value })
                }
                placeholder="Who should receive this secret?"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Contact Method</label>
              <Select
                value={formData.contact_method}
                onValueChange={(value: "email" | "phone" | "both") =>
                  setFormData({ ...formData, contact_method: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="How should we contact them?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="phone">Phone</SelectItem>
                  <SelectItem value="both">Both Email and Phone</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(formData.contact_method === "email" ||
              formData.contact_method === "both") && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Recipient's Email</label>
                <Input
                  type="email"
                  required
                  value={formData.recipient_email}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      recipient_email: e.target.value,
                    })
                  }
                  placeholder="Their email address"
                />
              </div>
            )}

            {(formData.contact_method === "phone" ||
              formData.contact_method === "both") && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Recipient's Phone</label>
                <Input
                  type="tel"
                  required
                  value={formData.recipient_phone}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      recipient_phone: e.target.value,
                    })
                  }
                  placeholder="Their phone number"
                />
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Check-in Interval</label>
              <Select
                value={formData.check_in_interval}
                onValueChange={(value) =>
                  setFormData({ ...formData, check_in_interval: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="How often should you check in?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Daily</SelectItem>
                  <SelectItem value="7">Weekly</SelectItem>
                  <SelectItem value="14">Every 2 weeks</SelectItem>
                  <SelectItem value="30">Monthly</SelectItem>
                  <SelectItem value="90">Every 3 months</SelectItem>
                  <SelectItem value="180">Every 6 months</SelectItem>
                  <SelectItem value="365">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
