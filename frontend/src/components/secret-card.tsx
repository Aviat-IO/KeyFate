"use client";

import { Button } from "@/components/ui/button";
import { CheckInButton } from "@/components/check-in-button";
import { Clock } from "lucide-react";
import Link from "next/link";
import { format } from "timeago.js";
import { Separator } from "@/components/ui/separator";

interface SecretCardProps {
  id: string;
  title: string;
  recipientName: string;
  status: "active" | "paused" | "triggered";
  nextCheckIn: string;
  lastCheckIn: string | null;
}

function getStatusBadge(status: string, nextCheckIn: string) {
  if (status !== "active") {
    return {
      label: status.charAt(0).toUpperCase() + status.slice(1),
      className:
        status === "paused"
          ? "bg-yellow-100 text-yellow-700"
          : "bg-red-100 text-red-700",
    };
  }

  const now = new Date();
  const checkInDate = new Date(nextCheckIn);
  const daysUntilCheckIn = Math.ceil(
    (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (daysUntilCheckIn <= 2) {
    return {
      label: "Urgent",
      className: "bg-red-100 text-red-700",
    };
  }

  if (daysUntilCheckIn <= 7) {
    return {
      label: "Upcoming",
      className: "bg-yellow-100 text-yellow-700",
    };
  }

  return {
    label: "Active",
    className: "bg-green-100 text-green-700",
  };
}

export function SecretCard({
  id,
  title,
  recipientName,
  status,
  nextCheckIn,
  lastCheckIn,
}: SecretCardProps) {
  const statusBadge = getStatusBadge(status, nextCheckIn);

  return (
    <div className="bg-card rounded-lg border p-4 shadow-sm">
      <div className="relative mb-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold">{title}</h3>
            <p className="text-muted-foreground text-sm">
              Recipient: {recipientName}
            </p>
          </div>
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusBadge.className}`}
          >
            {statusBadge.label}
          </span>
        </div>
      </div>

      <div className="text-muted-foreground flex flex-col gap-1 text-sm">
        <div className="flex items-center">
          <Clock className="mr-1 h-4 w-4" />
          Next check-in: {format(nextCheckIn)}
        </div>
        {lastCheckIn && (
          <div className="text-muted-foreground text-xs">
            Last check-in: {format(lastCheckIn)}
          </div>
        )}
      </div>

      <Separator className="my-4" />

      <div className="flex justify-end gap-2">
        <CheckInButton secretId={id} />
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/secrets/${id}/edit`}>Edit</Link>
        </Button>
      </div>
    </div>
  );
}
