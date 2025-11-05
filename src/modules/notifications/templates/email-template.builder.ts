/**
 * MASH Email Template System
 * 
 * Reusable email template with customizable header, logo, and banner
 * Features:
 * - Circular logo in the center
 * - Banner image overlapping behind the logo
 * - Fully responsive design
 * - Support for all email clients
 * - Easy customization
 */

export interface EmailTemplateOptions {
  // Header customization
  logoUrl?: string;
  bannerUrl?: string;
  logoAltText?: string;
  
  // Content
  title: string;
  preheaderText?: string;
  bodyContent: string; // HTML content for the email body
  
  // Call to Action (optional)
  ctaText?: string;
  ctaUrl?: string;
  ctaColor?: string;
  
  // Footer customization
  companyName?: string;
  companyAddress?: string;
  unsubscribeUrl?: string;
  privacyPolicyUrl?: string;
  termsUrl?: string;
  
  // Additional customization
  accentColor?: string;
  backgroundColor?: string;
}

export class EmailTemplateBuilder {
  private static readonly DEFAULT_LOGO_URL = 'https://mash-backend-api-production.up.railway.app/email-assets/logo-circle.svg';
  private static readonly DEFAULT_BANNER_URL = 'https://mash-backend-api-production.up.railway.app/email-assets/banner.svg';
  private static readonly DEFAULT_ACCENT_COLOR = '#4CAF50';
  private static readonly DEFAULT_BG_COLOR = '#f4f4f4';
  private static readonly DEFAULT_COMPANY_NAME = 'MASH - Mushroom Automation System';
  
  /**
   * Build complete email HTML from template
   */
  static build(options: EmailTemplateOptions): string {
    const {
      logoUrl = this.DEFAULT_LOGO_URL,
      bannerUrl = this.DEFAULT_BANNER_URL,
      logoAltText = 'MASH Logo',
      title,
      preheaderText = '',
      bodyContent,
      ctaText,
      ctaUrl,
      ctaColor = this.DEFAULT_ACCENT_COLOR,
      companyName = this.DEFAULT_COMPANY_NAME,
      companyAddress = '',
      unsubscribeUrl,
      privacyPolicyUrl,
      termsUrl,
      accentColor = this.DEFAULT_ACCENT_COLOR,
      backgroundColor = this.DEFAULT_BG_COLOR,
    } = options;

    return `
<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>${title}</title>
  
  <!-- Preheader text (hidden in email body, shown in preview) -->
  <div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">
    ${preheaderText || title}
  </div>
  
  <!--[if mso]>
  <style>
    * { font-family: Arial, sans-serif !important; }
  </style>
  <![endif]-->
  
  <style>
    /* Reset styles */
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; height: 100% !important; }
    
    /* Responsive styles */
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .mobile-padding { padding: 10px !important; }
      .mobile-hide { display: none !important; }
      .logo-circle { width: 100px !important; height: 100px !important; }
      .banner-image { height: 150px !important; }
    }
  </style>
</head>

<body style="margin: 0; padding: 0; background-color: ${backgroundColor}; font-family: Arial, 'Helvetica Neue', Helvetica, sans-serif;">
  <!-- Full width wrapper -->
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: ${backgroundColor};">
    <tr>
      <td align="center" style="padding: 20px 0;">
        
        <!-- Email container -->
        <table role="presentation" class="email-container" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-radius: 8px; overflow: hidden;">
          
          <!-- Header with Banner and Circular Logo -->
          <tr>
            <td style="position: relative; padding: 0;">
              <!-- Banner image (background) -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="position: relative; height: 200px; background-color: ${accentColor};">
                    <img src="${bannerUrl}" 
                         alt="Banner" 
                         class="banner-image"
                         width="600" 
                         height="200" 
                         style="width: 100%; height: 200px; object-fit: cover; display: block; opacity: 0.9;" />
                    
                    <!-- Circular logo overlay (positioned in center) -->
                    <div style="position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);">
                      <!--[if mso]>
                      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                        <tr>
                          <td style="text-align: center;">
                      <![endif]-->
                      <img src="${logoUrl}" 
                           alt="${logoAltText}" 
                           class="logo-circle"
                           width="120" 
                           height="120" 
                           style="width: 120px; height: 120px; border-radius: 50%; border: 5px solid #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.2); display: block; background-color: #ffffff;" />
                      <!--[if mso]>
                          </td>
                        </tr>
                      </table>
                      <![endif]-->
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Main content area -->
          <tr>
            <td class="mobile-padding" style="padding: 40px 40px 20px 40px;">
              <!-- Title -->
              <h1 style="margin: 0 0 20px 0; font-size: 28px; font-weight: bold; color: #333333; text-align: center; line-height: 1.3;">
                ${title}
              </h1>
              
              <!-- Body content -->
              <div style="font-size: 16px; line-height: 1.6; color: #555555;">
                ${bodyContent}
              </div>
            </td>
          </tr>
          
          ${ctaText && ctaUrl ? `
          <!-- Call to Action Button -->
          <tr>
            <td align="center" style="padding: 20px 40px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="border-radius: 6px; background-color: ${ctaColor};">
                    <a href="${ctaUrl}" 
                       target="_blank" 
                       style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: bold; color: #ffffff; text-decoration: none; border-radius: 6px;">
                      ${ctaText}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}
          
          <!-- Spacer -->
          <tr>
            <td style="padding: 20px;">
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9f9f9; border-top: 1px solid #eeeeee;">
              <!-- Company info -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="text-align: center; padding-bottom: 15px;">
                    <p style="margin: 0; font-size: 18px; font-weight: bold; color: ${accentColor};">
                      🍄 ${companyName}
                    </p>
                    ${companyAddress ? `
                    <p style="margin: 5px 0 0 0; font-size: 13px; color: #999999;">
                      ${companyAddress}
                    </p>
                    ` : ''}
                  </td>
                </tr>
                
                <!-- Social links / Footer links -->
                <tr>
                  <td style="text-align: center; padding: 15px 0;">
                    ${privacyPolicyUrl || termsUrl || unsubscribeUrl ? `
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                      <tr>
                        ${privacyPolicyUrl ? `
                        <td style="padding: 0 10px;">
                          <a href="${privacyPolicyUrl}" style="font-size: 13px; color: #999999; text-decoration: none;">
                            Privacy Policy
                          </a>
                        </td>
                        <td style="color: #cccccc;">|</td>
                        ` : ''}
                        ${termsUrl ? `
                        <td style="padding: 0 10px;">
                          <a href="${termsUrl}" style="font-size: 13px; color: #999999; text-decoration: none;">
                            Terms of Service
                          </a>
                        </td>
                        ${unsubscribeUrl ? '<td style="color: #cccccc;">|</td>' : ''}
                        ` : ''}
                        ${unsubscribeUrl ? `
                        <td style="padding: 0 10px;">
                          <a href="${unsubscribeUrl}" style="font-size: 13px; color: #999999; text-decoration: none;">
                            Unsubscribe
                          </a>
                        </td>
                        ` : ''}
                      </tr>
                    </table>
                    ` : ''}
                  </td>
                </tr>
                
                <!-- Copyright -->
                <tr>
                  <td style="text-align: center; padding-top: 15px;">
                    <p style="margin: 0; font-size: 12px; color: #999999;">
                      © ${new Date().getFullYear()} ${companyName}. All rights reserved.
                    </p>
                    <p style="margin: 5px 0 0 0; font-size: 11px; color: #bbbbbb;">
                      This is an automated message. Please do not reply to this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
        <!-- End email container -->
        
      </td>
    </tr>
  </table>
  <!-- End full width wrapper -->
</body>
</html>
    `.trim();
  }

  /**
   * Generate plain text version of email
   */
  static buildPlainText(options: EmailTemplateOptions): string {
    const {
      title,
      bodyContent,
      ctaText,
      ctaUrl,
      companyName = this.DEFAULT_COMPANY_NAME,
      companyAddress = '',
    } = options;

    // Strip HTML tags from body content
    const plainBody = bodyContent
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();

    return `
${title}
${'='.repeat(title.length)}

${plainBody}

${ctaText && ctaUrl ? `
${ctaText}: ${ctaUrl}
` : ''}

---
${companyName}
${companyAddress}

© ${new Date().getFullYear()} ${companyName}. All rights reserved.
This is an automated message. Please do not reply to this email.
    `.trim();
  }
}
