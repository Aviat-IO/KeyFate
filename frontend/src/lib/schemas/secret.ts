import * as z from "zod";

export const secretFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  message: z.string().min(1, "Message is required"),
  recipient_name: z.string().min(1, "Recipient name is required"),
  recipient_email: z.string().email().optional(),
  recipient_phone: z.string().optional(),
  contact_method: z.enum(["email", "phone", "both"]),
  check_in_days: z.string(),
});

export type SecretFormValues = z.infer<typeof secretFormSchema>;
