"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Crown, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TIER_CONFIGS } from "@/constants/tiers";

interface SubscriptionManagementProps {
  tierInfo: any;
}

export function SubscriptionManagement({ tierInfo }: SubscriptionManagementProps) {
  const router = useRouter();
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isProUser = tierInfo.tier?.tiers?.name === "pro";
  const subscription = tierInfo.subscription;
  const scheduledDowngradeAt = subscription?.scheduledDowngradeAt;
  const currentPeriodEnd = subscription?.currentPeriodEnd;

  const handleScheduleDowngrade = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/user/subscription/schedule-downgrade", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to schedule downgrade");
      }

      setShowDowngradeDialog(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule downgrade");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelDowngrade = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/user/subscription/cancel-downgrade", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to cancel downgrade");
      }

      setShowCancelDialog(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel downgrade");
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (date: Date | string | undefined) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                Current Plan
                {isProUser && !scheduledDowngradeAt && <Crown className="h-5 w-5 text-primary" />}
              </CardTitle>
              <CardDescription>Your subscription details</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isProUser ? "default" : "secondary"}>
                {isProUser ? "Pro" : "Free"}
              </Badge>
              {scheduledDowngradeAt && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Ending Soon
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isProUser && subscription && (
            <>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Status</label>
                <p className="text-lg capitalize">{subscription.status}</p>
              </div>
              {currentPeriodEnd && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Current Period Ends
                  </label>
                  <p className="text-lg">{formatDate(currentPeriodEnd)}</p>
                </div>
              )}
            </>
          )}

          {!isProUser && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">Limits</label>
              <ul className="text-lg space-y-1 mt-2">
                <li>• 1 secret</li>
                <li>• 1 recipient per secret</li>
                <li>• Limited check-in intervals</li>
              </ul>
            </div>
          )}

          {scheduledDowngradeAt && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <div className="flex gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-destructive">Downgrade Scheduled</p>
                  <p className="text-sm text-muted-foreground">
                    Your subscription will end on {formatDate(scheduledDowngradeAt)}.
                    You'll be downgraded to the Free plan at that time.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manage Subscription</CardTitle>
          <CardDescription>
            {isProUser
              ? "Change your subscription plan"
              : "Upgrade to unlock more features"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isProUser ? (
            <Button asChild className="w-full">
              <Link href="/pricing">Upgrade to Pro</Link>
            </Button>
          ) : scheduledDowngradeAt ? (
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(true)}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Processing..." : "Cancel Scheduled Downgrade"}
            </Button>
          ) : (
            <Button
              variant="destructive"
              onClick={() => setShowDowngradeDialog(true)}
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? "Processing..." : "Downgrade to Free"}
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={showDowngradeDialog} onOpenChange={(open) => {
        setShowDowngradeDialog(open);
        if (!open) setError(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Downgrade to Free Plan?</DialogTitle>
            <DialogDescription asChild>
              <div>
                <p className="text-sm text-muted-foreground">
                  Your Pro subscription will remain active until {formatDate(currentPeriodEnd)}.
                  After that date, you'll be downgraded to the Free plan.
                </p>
                <p className="text-sm text-muted-foreground mt-4">You'll be limited to Free tier features:</p>
                <ul className="list-disc list-inside mt-2 space-y-1 text-sm text-muted-foreground">
                  {TIER_CONFIGS.free?.features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
                <p className="text-sm text-muted-foreground mt-4">
                  Your existing secrets will be preserved (grandfathered).
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDowngradeDialog(false)} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleScheduleDowngrade}
              disabled={isLoading}
              variant="destructive"
            >
              {isLoading ? "Processing..." : "Confirm Downgrade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelDialog} onOpenChange={(open) => {
        setShowCancelDialog(open);
        if (!open) setError(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Scheduled Downgrade?</DialogTitle>
            <DialogDescription>
              This will cancel your scheduled downgrade. Your Pro subscription will continue
              as normal and renew at the end of the current period.
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="rounded-lg border border-destructive bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)} disabled={isLoading}>
              No, Keep Downgrade
            </Button>
            <Button
              onClick={handleCancelDowngrade}
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : "Yes, Cancel Downgrade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
