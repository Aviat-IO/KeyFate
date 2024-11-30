"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ContactMethodsForm } from "@/components/contact-methods-form";
import type { ContactMethods } from "@/hooks/useContactMethods";

interface ContactMethodsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (methods: ContactMethods) => Promise<void>;
}

export function ContactMethodsDialog({
  open,
  onOpenChange,
  onSubmit,
}: ContactMethodsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Set Up Contact Methods</DialogTitle>
          <DialogDescription>
            Please provide at least one way for us to contact you for check-ins.
            This information will be saved for future use.
          </DialogDescription>
        </DialogHeader>
        <ContactMethodsForm
          onSubmit={async (methods) => {
            await onSubmit(methods);
            onOpenChange(false);
          }}
          submitLabel="Continue"
        />
      </DialogContent>
    </Dialog>
  );
}
