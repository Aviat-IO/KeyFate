import * as z from "zod";

export const secretFormSchema = z.object({
  title: z.string().min(1, "Title is required"),
  secretMessageContent: z.string().min(1, "Secret message is required"),
  recipient_name: z.string().min(1, "Recipient name is required"),
  recipient_email: z.string().email().optional(),
  recipient_phone: z.string().optional(),
  contact_method: z.enum(["email", "phone", "both"]),
  check_in_days: z.string().refine((val) => parseInt(val, 10) >= 2, {
    message: "Check-in frequency must be at least 2 days.",
  }),
  sss_shares_total: z
    .number({
      required_error: "Total shares is required.",
      invalid_type_error: "Total shares must be a number.",
    })
    .min(2, "Total shares must be at least 2.")
    .max(10, "Total shares cannot exceed 10."),
  sss_threshold: z
    .number({
      required_error: "Threshold is required.",
      invalid_type_error: "Threshold must be a number.",
    })
    .min(2, "Threshold must be at least 2.")
    .max(10, "Threshold cannot exceed 10."),
}).refine((data) => {
  // Ensure data.sss_threshold and data.sss_shares_total are numbers before comparison
  // This should be guaranteed by the .number() type, but good for robustness
  return typeof data.sss_threshold === "number" &&
    typeof data.sss_shares_total === "number" &&
    data.sss_threshold <= data.sss_shares_total;
}, {
  message: "Threshold must be less than or equal to total shares.",
  path: ["sss_threshold"], // This error will appear under the threshold field
});

export type SecretFormValues = z.infer<typeof secretFormSchema>;
