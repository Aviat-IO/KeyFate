"use client";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { APP_URL } from "@/lib/env";
import { Loader2 } from "lucide-react";
import { useState } from "react";

interface CheckInButtonProps {
  secretId: string;
  onCheckInSuccess?: () => void;
}

export function CheckInButton({
  secretId,
  onCheckInSuccess,
}: CheckInButtonProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleCheckIn = async () => {
    setLoading(true);

    try {
      const response = await fetch(
        `${APP_URL}/api/secrets/${secretId}/check-in`,
        {
          method: "POST",
        },
      );

      if (!response.ok) {
        throw new Error("Failed to check in");
      }

      toast({
        title: "Check-in successful",
        description: "Your check-in time has been updated.",
      });

      onCheckInSuccess?.();
    } catch (error) {
      console.error("Error checking in:", error);
      toast({
        variant: "destructive",
        title: "Check-in failed",
        description: "Please try again later.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleCheckIn}
      disabled={loading}
      variant="outline"
      size="sm"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Checking in...
        </>
      ) : (
        "Check In"
      )}
    </Button>
  );
}
