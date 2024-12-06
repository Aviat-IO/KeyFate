interface ReminderTemplateData {
  secretTitle: string;
  timeRemaining: string;
  nextCheckIn: string;
  checkInUrl: string;
}

interface SecretTriggerTemplateData {
  recipientName: string;
  senderEmail: string;
  secretTitle: string;
  secretMessage: string;
}

export function getReminderEmailTemplate({
  secretTitle,
  timeRemaining,
  nextCheckIn,
  checkInUrl,
}: ReminderTemplateData): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>Time to Check In</title>
        <style>
          /* Base */
          body {
            background-color: #f6f9fc;
            font-family: sans-serif;
            -webkit-font-smoothing: antialiased;
            font-size: 14px;
            line-height: 1.4;
            margin: 0;
            padding: 0;
            -ms-text-size-adjust: 100%;
            -webkit-text-size-adjust: 100%;
          }
          
          table {
            border-collapse: separate;
            width: 100%;
          }
          
          .container {
            background: #ffffff;
            border-radius: 8px;
            padding: 24px;
            max-width: 600px;
            margin: 24px auto;
          }
          
          .header {
            padding-bottom: 24px;
            text-align: center;
            border-bottom: 1px solid #e9ecef;
          }
          
          .content {
            padding: 24px 0;
          }
          
          .footer {
            padding-top: 24px;
            text-align: center;
            font-size: 12px;
            color: #6c757d;
            border-top: 1px solid #e9ecef;
          }
          
          .button {
            background-color: #2563eb;
            border-radius: 6px;
            color: #ffffff;
            display: inline-block;
            font-size: 14px;
            font-weight: bold;
            margin: 16px 0;
            padding: 12px 24px;
            text-decoration: none;
            text-align: center;
          }
          
          .warning {
            color: #dc2626;
            font-weight: bold;
          }
          
          .highlight {
            color: #2563eb;
            font-weight: bold;
          }

          .message-box {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 16px;
            margin: 16px 0;
          }
        </style>
      </head>
      <body>
        <table role="presentation">
          <tr>
            <td>
              <div class="container">
                <div class="header">
                  <h1 style="color: #1f2937; margin: 0;">Time to Check In</h1>
                </div>
                
                <div class="content">
                  <p>Your secret "<span class="highlight">${secretTitle}</span>" needs attention.</p>
                  
                  <p>You have <span class="highlight">${timeRemaining}</span> remaining to check in.</p>
                  
                  <p class="warning">If you don't check in by ${nextCheckIn}, your secret will be triggered.</p>
                  
                  <div style="text-align: center;">
                    <a href="${checkInUrl}" class="button">
                      Check In Now
                    </a>
                  </div>
                  
                  <p style="margin-top: 24px;">
                    For your security, this link will take you to your dashboard where you can check in safely.
                  </p>
                </div>
                
                <div class="footer">
                  <p>This is an automated message from KeyFate. Please do not reply to this email.</p>
                  <p>If you did not set up this secret, please contact support immediately.</p>
                </div>
              </div>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

export function getSecretTriggerTemplate({
  recipientName,
  senderEmail,
  secretTitle,
  secretMessage,
}: SecretTriggerTemplateData): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <title>Important Message from ${senderEmail}</title>
        <style>
          /* Base */
          body {
            background-color: #f6f9fc;
            font-family: sans-serif;
            -webkit-font-smoothing: antialiased;
            font-size: 14px;
            line-height: 1.4;
            margin: 0;
            padding: 0;
            -ms-text-size-adjust: 100%;
            -webkit-text-size-adjust: 100%;
          }
          
          table {
            border-collapse: separate;
            width: 100%;
          }
          
          .container {
            background: #ffffff;
            border-radius: 8px;
            padding: 24px;
            max-width: 600px;
            margin: 24px auto;
          }
          
          .header {
            padding-bottom: 24px;
            text-align: center;
            border-bottom: 1px solid #e9ecef;
          }
          
          .content {
            padding: 24px 0;
          }
          
          .footer {
            padding-top: 24px;
            text-align: center;
            font-size: 12px;
            color: #6c757d;
            border-top: 1px solid #e9ecef;
          }
          
          .warning {
            color: #dc2626;
            font-weight: bold;
          }
          
          .highlight {
            color: #2563eb;
            font-weight: bold;
          }

          .message-box {
            background-color: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 16px;
            margin: 16px 0;
            white-space: pre-wrap;
          }
        </style>
      </head>
      <body>
        <table role="presentation">
          <tr>
            <td>
              <div class="container">
                <div class="header">
                  <h1 style="color: #1f2937; margin: 0;">Important Message</h1>
                </div>
                
                <div class="content">
                  <p>Dear ${recipientName},</p>
                  
                  <p>You are receiving this message because <span class="highlight">${senderEmail}</span> has designated you as a trusted contact for their secret titled "<span class="highlight">${secretTitle}</span>".</p>
                  
                  <p>They have not checked in within their specified timeframe, and as a result, this message has been automatically sent to you.</p>
                  
                  <p class="warning">Below is their message:</p>
                  
                  <div class="message-box">
                    ${secretMessage}
                  </div>
                  
                  <p style="margin-top: 24px;">
                    Please handle this information with appropriate care and discretion.
                  </p>
                </div>
                
                <div class="footer">
                  <p>This is an automated message from KeyFate. Please do not reply to this email.</p>
                  <p>If you believe you received this message in error, please contact support immediately.</p>
                </div>
              </div>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
