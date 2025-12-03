import nodemailer from "nodemailer"
import { SENDGRID_UNSUBSCRIBE_GROUPS, type UnsubscribeGroup } from "@/lib/email/constants"

// Re-export for backwards compatibility
export { type UnsubscribeGroup } from "@/lib/email/constants"

export interface EmailOptions {
  to: string
  subject: string
  html: string
  text: string
  from?: string
  unsubscribeGroup?: UnsubscribeGroup
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
}

class SMTPService {
  private transporter: nodemailer.Transporter | null = null

  private async getTransporter() {
    if (this.transporter) {
      return this.transporter
    }

    const smtpConfig = this.getSMTPConfig()
    this.transporter = nodemailer.createTransport(smtpConfig)

    // Verify connection
    try {
      await this.transporter.verify()
      console.log("SMTP connection verified successfully")
    } catch (error) {
      console.error("SMTP connection verification failed:", error)
      throw new Error("Failed to connect to SMTP server")
    }

    return this.transporter
  }

  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    try {
      const transporter = await this.getTransporter()

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://keyfate.com"
      const unsubscribeUrl = `${siteUrl}/settings/notifications`

      const mailOptions = {
        from:
          options.from ||
          process.env.SENDGRID_ADMIN_EMAIL ||
          "support@keyfate.com",
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        headers: {
          // List-Unsubscribe helps deliverability with Gmail/Outlook
          "List-Unsubscribe": `<${unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          "X-SMTPAPI": JSON.stringify({
            // SendGrid ASM (Advanced Suppression Manager) for unsubscribe groups
            ...(options.unsubscribeGroup && {
              asm: {
                group_id: SENDGRID_UNSUBSCRIBE_GROUPS[options.unsubscribeGroup],
                groups_to_display: Object.values(SENDGRID_UNSUBSCRIBE_GROUPS),
              },
            }),
            tracking_settings: {
              click_tracking: {
                enable: false,
              },
            },
          }),
        },
      }

      const result = await transporter.sendMail(mailOptions)

      return {
        success: true,
        messageId: result.messageId,
      }
    } catch (error) {
      console.error("Failed to send email:", error)
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  private getSMTPConfig() {
    const provider = process.env.SMTP_PROVIDER || "sendgrid"

    switch (provider.toLowerCase()) {
      case "sendgrid":
        return this.getSendGridConfig()
      case "mailgun":
        return this.getMailgunConfig()
      case "ses":
      case "aws-ses":
        return this.getAWSSESConfig()
      case "smtp":
      case "custom":
        return this.getCustomSMTPConfig()
      default:
        throw new Error(`Unsupported SMTP provider: ${provider}`)
    }
  }

  private getSendGridConfig() {
    const apiKey = process.env.SENDGRID_API_KEY
    if (!apiKey) {
      throw new Error("SENDGRID_API_KEY is required for SendGrid")
    }

    return {
      host: "smtp.sendgrid.net",
      port: 587,
      secure: false,
      auth: {
        user: "apikey",
        pass: apiKey,
      },
    }
  }

  private getMailgunConfig() {
    const username = process.env.MAILGUN_SMTP_USERNAME
    const password = process.env.MAILGUN_SMTP_PASSWORD
    const domain = process.env.MAILGUN_DOMAIN

    if (!username || !password) {
      throw new Error(
        "MAILGUN_SMTP_USERNAME and MAILGUN_SMTP_PASSWORD are required for Mailgun",
      )
    }

    return {
      host: `smtp.${domain ? `${domain}.` : ""}mailgun.org`,
      port: 587,
      secure: false,
      auth: {
        user: username,
        pass: password,
      },
    }
  }

  private getAWSSESConfig() {
    const accessKeyId = process.env.AWS_ACCESS_KEY_ID
    const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY
    const region = process.env.AWS_REGION || "us-east-1"

    if (!accessKeyId || !secretAccessKey) {
      throw new Error(
        "AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are required for AWS SES",
      )
    }

    return {
      host: `email-smtp.${region}.amazonaws.com`,
      port: 587,
      secure: false,
      auth: {
        user: accessKeyId,
        pass: secretAccessKey,
      },
    }
  }

  private getCustomSMTPConfig() {
    const host = process.env.SMTP_HOST
    const port = parseInt(process.env.SMTP_PORT || "587")
    const secure = process.env.SMTP_SECURE === "true"
    const username = process.env.SMTP_USERNAME
    const password = process.env.SMTP_PASSWORD

    if (!host) {
      throw new Error("SMTP_HOST is required for custom SMTP")
    }

    const config: any = {
      host,
      port,
      secure,
    }

    if (username && password) {
      config.auth = {
        user: username,
        pass: password,
      }
    }

    return config
  }

  // Test email functionality
  async sendTestEmail(to: string): Promise<EmailResult> {
    return this.sendEmail({
      to,
      subject: "Test Email - Dead Man's Switch",
      html: `
        <h1>Test Email</h1>
        <p>This is a test email from Dead Man's Switch to verify SMTP configuration.</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      `,
      text: `
Test Email

This is a test email from Dead Man's Switch to verify SMTP configuration.
Sent at: ${new Date().toISOString()}
      `,
    })
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      const transporter = await this.getTransporter()
      await transporter.verify()
      return true
    } catch (error) {
      console.error("SMTP health check failed:", error)
      return false
    }
  }

  // Close connection
  async close() {
    if (this.transporter) {
      this.transporter.close()
      this.transporter = null
    }
  }
}

export const smtpService = new SMTPService()
