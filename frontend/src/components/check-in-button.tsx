import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { APP_URL } from "@/lib/env";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export function CheckInButton() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleCheckIn = async () => {
    setLoading(true);

    try {
      const response = await fetch(`${APP_URL}/api/check-in`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to check in");
      }

      toast({
        title: "Check-in successful",
        description:
          "Your check-in time has been updated for all active secrets.",
      });
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
      size="lg"
      className="w-full md:w-auto"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Checking in...
        </>
      ) : (
        "Check In Now"
      )}
    </Button>
  );
}
