export const BASE_EMAIL_TEMPLATE = `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" style="margin:0; padding:0;">
  <head>
    <meta charset="UTF-8" />
    <title>{{ .Title }} - Navigate Wealth</title>

    <!-- Light & Dark Mode Support -->
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">

    <!--[if gte mso 9]>
    <xml>
      <o:OfficeDocumentSettings>
        <o:AllowPNG/>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
    <![endif]-->

    <style>
      /* Reset paragraph margins for tighter spacing */
      p {
        margin-top: 0 !important;
        margin-bottom: 10px !important;
      }
      ul, ol {
        margin-top: 0 !important;
        margin-bottom: 10px !important;
      }
      
      @media (prefers-color-scheme: dark) {
        body.email-body {
          background-color: #020617 !important;
        }
        table.email-card {
          background-color: #020617 !important;
          border-color: #1f2937 !important;
        }
        .email-text,
        .email-heading,
        .email-footer {
          color: #e5e7eb !important;
        }
        .email-muted {
          color: #9ca3af !important;
        }
        .email-link {
          color: #a855f7 !important;
        }
        .email-button {
          background-color: #8b5cf6 !important;
        }
      }
    </style>
  </head>

  <body class="email-body" style="background-color:#f3f4f6; margin:0; padding:40px 0; font-family: Arial, sans-serif;">

    <table align="center" width="600" cellpadding="0" cellspacing="0"
           class="email-card"
           style="
             background-color:#ffffff;
             border-radius:12px;
             border:1px solid #e5e7eb;
             padding:0;
             text-align:center;
             font-family: Arial, sans-serif;
             box-shadow:0 8px 20px rgba(15,23,42,0.10);
           ">

      <!-- Gradient Accent -->
      <tr>
        <td style="
          height:5px;
          background:linear-gradient(90deg,#6d28d9,#a855f7,#6d28d9);
          border-radius:12px 12px 0 0;">
        </td>
      </tr>

      <!-- Main Content -->
      <tr>
        <td style="padding:30px 32px 24px 32px;">

          <!-- Logo -->
          <div style="margin-bottom:20px;">
            <span style="font-size:24px; font-weight:bold; color:#000000;">Navigate</span>
            <span style="font-size:24px; font-weight:bold; color:#6d28d9;">Wealth</span>
          </div>

          <!-- Heading -->
          <div class="email-heading"
               style="font-size:16px; font-weight:bold; color:#111827; margin-bottom:24px;">
            {{ .Title }}
          </div>

          <!-- Subtitle / Intro -->
          <div class="email-muted"
               style="font-size:14px; color:#6b7280; margin-bottom:20px;">
            {{ .Subtitle }}
          </div>

          <!-- Greeting -->
          <div class="email-text"
               style="font-size:14px; color:#374151; line-height:1.6; text-align:left; margin:0 auto 8px auto; max-width:100%;">
            {{ .Greeting }}
          </div>

          <!-- Main Body (WYSIWYG content) -->
          <div class="email-text"
               style="font-size:14px; color:#374151; line-height:1.6; text-align:left; margin:0 auto 18px auto; max-width:100%;">
            <!-- Inject rich HTML content from WYSIWYG here -->
            {{ .BodyHtml }}
          </div>

          <!-- Optional CTA Button -->
          {{ if .ButtonURL }}
          <div style="text-align:center; margin:10px 0 6px 0;">
            <!--[if mso]>
            <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml"
                         xmlns:w="urn:schemas-microsoft-com:office:word"
                         href="{{ .ButtonURL }}"
                         style="height:40px; v-text-anchor:middle; width:220px;"
                         arcsize="50%"
                         strokecolor="#6d28d9"
                         fillcolor="#6d28d9">
              <w:anchorlock/>
              <center style="color:#ffffff; font-family:Arial,sans-serif; font-size:14px; font-weight:bold;">
                {{ .ButtonLabel }}
              </center>
            </v:roundrect>
            <![endif]-->
            <!--[if !mso]><!-->
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;">
              <tr>
                <td align="center" valign="middle" style="
                  background-color:#6d28d9;
                  border-radius:999px;
                  mso-padding-alt:0;
                ">
                  <a href="{{ .ButtonURL }}"
                     class="email-button"
                     target="_blank"
                     style="
                       display:inline-block;
                       background-color:#6d28d9;
                       color:#ffffff;
                       padding:10px 28px;
                       text-decoration:none;
                       border-radius:999px;
                       font-weight:bold;
                       font-size:14px;
                       font-family:Arial,sans-serif;
                       mso-hide:all;
                     ">
                    {{ .ButtonLabel }}
                  </a>
                </td>
              </tr>
            </table>
            <!--<![endif]-->
          </div>
          {{ end }}

          <!-- Optional small note under button -->
          {{ if .FooterNote }}
          <div class="email-text"
               style="font-size:12px; color:#6b7280; line-height:1.6; margin-top:10px; text-align:center;">
            {{ .FooterNote }}
          </div>
          {{ end }}

        </td>
      </tr>

      <!-- Divider -->
      <tr>
        <td style="padding:0 32px;">
          <hr style="border:none; border-top:1px solid #e5e7eb; margin:0;">
        </td>
      </tr>

      <!-- Footer -->
      <tr>
        <td class="email-footer"
            style="padding:18px 32px 24px 32px; font-size:12px; color:#6b7280; line-height:1.6; text-align:center;">

          <p style="margin:0;">
            <strong>Navigate Wealth</strong><br />
            Independent Financial Advisory Services
          </p>

          <p style="margin:8px 0 0;">
            First Floor, Milestone Place, Block A<br />
            25 Sovereign Dr, Route 21 Business Park<br />
            Irene, 0157
          </p>

          <p style="margin:8px 0 0;">
            Email:
            <a href="mailto:info@navigatewealth.co"
               class="email-link"
               style="color:#6d28d9; text-decoration:none;">
              info@navigatewealth.co
            </a>
          </p>

          <p style="margin:12px 0 0;">
            <strong>Follow us:</strong><br />
            <a href="https://www.linkedin.com/company/navigatewealth/"
               class="email-link" style="color:#6d28d9; text-decoration:none;">LinkedIn</a> |
            <a href="https://www.instagram.com/navigate_wealth?igsh=MTh6bTc2emszbXU0MA=="
               class="email-link"
               style="color:#6d28d9; text-decoration:none;">Instagram</a> |
            <a href="https://www.youtube.com/@navigatewealth"
               class="email-link"
               style="color:#6d28d9; text-decoration:none;">YouTube</a>
          </p>

          <p style="margin:12px 0 0;" class="email-muted">
            &copy; {{ .Year }} Navigate Wealth. All rights reserved.
          </p>

        </td>
      </tr>

    </table>
  </body>
</html>`;