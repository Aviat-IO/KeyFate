import * as z from "zod"

const recipientSchema = z
  .object({
    name: z.string().min(1, "Recipient name is required"),
    email: z
      .string()
      .email("Valid email is required")
      .optional()
      .or(z.literal("")),
    phone: z.string().optional(),
  })
  .refine(
    (data) => {
      return (
        (data.email && data.email.length > 0) ||
        (data.phone && data.phone.length > 0)
      )
    },
    {
      message: "At least email or phone is required",
      path: ["email"],
    },
  )

export const secretFormSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    secretMessageContent: z.string().min(1, "Secret message is required"),
    recipients: z
      .array(recipientSchema)
      .min(1, "At least one recipient is required")
      .max(5, "Maximum 5 recipients allowed"),
    check_in_days: z.string().refine((val) => parseInt(val, 10) >= 1, {
      message: "Trigger deadline must be at least 1 day.",
    }),
    sss_shares_total: z
      .union([z.string(), z.number()])
      .transform((val) => {
        if (typeof val === "string") {
          if (val === "") return undefined
          const num = parseInt(val, 10)
          return isNaN(num) ? undefined : num
        }
        return val
      })
      .pipe(
        z
          .number({
            required_error: "Total shares is required.",
            invalid_type_error: "Total shares must be a number.",
          })
          .min(3, "Total shares must be at least 3.")
          .max(7, "Total shares cannot exceed 7."),
      ),
    sss_threshold: z
      .union([z.string(), z.number()])
      .transform((val) => {
        if (typeof val === "string") {
          if (val === "") return undefined
          const num = parseInt(val, 10)
          return isNaN(num) ? undefined : num
        }
        return val
      })
      .pipe(
        z
          .number({
            required_error: "Threshold is required.",
            invalid_type_error: "Threshold must be a number.",
          })
           .min(2, "Threshold must be at least 2.")
          .max(7, "Threshold cannot exceed 7."),
      ),
  })
  .refine(
    (data) => {
      // Ensure data.sss_threshold and data.sss_shares_total are numbers before comparison
      // This should be guaranteed by the .number() type, but good for robustness
      return (
        typeof data.sss_threshold === "number" &&
        typeof data.sss_shares_total === "number" &&
        data.sss_threshold <= data.sss_shares_total
      )
    },
    {
      message: "Threshold must be less than or equal to total shares.",
      path: ["sss_threshold"], // This error will appear under the threshold field
    },
  )

export type SecretFormValues = z.infer<typeof secretFormSchema>

// Schema for API operations with server-side fields
export const secretSchema = z
  .object({
    title: z.string().min(1, "Title is required"),
    server_share: z
      .string({
        required_error: "Missing server share.",
      })
      .min(1, "Missing server share."),
    iv: z.string().optional(),
    auth_tag: z.string().optional(),
    recipients: z
      .array(
        z.object({
          name: z.string().min(1, "Recipient name is required"),
          email: z
            .string()
            .email("Valid email is required")
            .optional()
            .or(z.literal("")),
          phone: z.string().optional(),
        }),
      )
      .min(1, "At least one recipient is required")
      .max(5, "Maximum 5 recipients allowed"),
    check_in_days: z
      .union([z.string(), z.number()])
      .transform((val) => {
        if (typeof val === "string") {
          const num = parseInt(val, 10)
          return isNaN(num) ? undefined : num
        }
        return val
      })
      .pipe(
        z
          .number({
            required_error: "Check-in days is required.",
            invalid_type_error: "Check-in days must be a number.",
          })
          .min(1, "Trigger deadline must be at least 1 day."),
      ),
    next_check_in: z.string().optional(),
    status: z.enum(["active", "paused", "triggered"]).default("active"),
    sss_shares_total: z
      .number()
      .min(3, "Invalid SSS shares total or threshold parameters.")
      .max(7),
    sss_threshold: z
      .number()
      .min(2, "Invalid SSS shares total or threshold parameters.")
      .max(7),
  })
  .refine(
    (data) => {
      return data.sss_threshold <= data.sss_shares_total
    },
    {
      message: "Invalid SSS shares total or threshold parameters.",
      path: ["sss_threshold"],
    },
  )

export type SecretValues = z.infer<typeof secretSchema>
