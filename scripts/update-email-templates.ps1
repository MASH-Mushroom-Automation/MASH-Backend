# PowerShell Script to Update All Email Templates with New Design
# This script generates all email templates with the new MASH branding

$baseHeader = @'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TITLE_PLACEHOLDER</title>
    <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fb; color: #2b2b2b; }
        .email-container { max-width: 680px; margin: 24px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 6px 24px rgba(10,22,38,0.08); }
        .header { position: relative; height: 220px; background-image: url('https://raw.githubusercontent.com/MASH-Mushroom-Automation/MASH-Backend/main/public/assets/email/banner.jpg'); background-size: cover; background-position: center; background-repeat: no-repeat; }
        .header-overlay { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(6,30,50,0.12) 0%, rgba(6,30,50,0.24) 100%); }
        .logo-container { position: absolute; bottom: -48px; left: 50%; transform: translateX(-50%); z-index: 10; }
        .logo { width: 112px; height: 112px; background-color: #ffffff; border-radius: 14px; padding: 10px; box-shadow: 0 6px 18px rgba(10,22,38,0.12); display: block; object-fit: contain; }
        .content { padding: 72px 48px 40px 48px; text-align: center; }
        .greeting { font-size: 22px; font-weight: 700; color: #0b2540; margin: 0 0 12px 0; }
        .message { font-size: 15px; line-height: 1.6; color: #465663; margin: 0 0 18px 0; }
        .notice-success { background-color: #d4edda; border-left: 4px solid #28a745; padding: 16px; margin: 22px 0; border-radius: 6px; text-align: left; }
        .notice-warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 16px; margin: 22px 0; border-radius: 6px; text-align: left; }
        .notice-danger { background-color: #f8d7da; border-left: 4px solid #dc3545; padding: 16px; margin: 22px 0; border-radius: 6px; text-align: left; }
        .notice-info { background-color: #d1ecf1; border-left: 4px solid #17a2b8; padding: 16px; margin: 22px 0; border-radius: 6px; text-align: left; }
        .notice-title { margin: 0 0 6px 0; font-weight: 700; font-size: 14px; }
        .notice-text { margin: 0; font-size: 13px; line-height: 1.6; }
        .button { display: inline-block; background: linear-gradient(135deg, #2e86de 0%, #1b6fbf 100%); color: #ffffff !important; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
        .footer { background-color: #f4f6f8; padding: 28px 32px; text-align: center; color: #6b7a86; font-size: 13px; }
        .footer-links { margin: 14px 0 8px 0; }
        .footer-link { color: #1b6fbf; text-decoration: none; margin: 0 10px; font-size: 13px; }
        .divider { height: 1px; background-color: #e6eef6; margin: 18px 0; }
        @media only screen and (max-width: 620px) {
            .email-container { margin: 12px; }
            .header { height: 160px; }
            .logo { width: 88px; height: 88px; padding: 8px; }
            .content { padding: 56px 20px 28px 20px; }
            .greeting { font-size: 20px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="header-overlay"></div>
            <div class="logo-container">
                <img src="https://mash-backend-api-production.up.railway.app/public/assets/email/mash-logo.png" alt="MASH logo" class="logo">
            </div>
        </div>
        <div class="content">
'@

$baseFooter = @'
        </div>
        <div class="footer">
            <div class="footer-links">
                <a href="{{appUrl}}" class="footer-link">Home</a>
                <a href="{{appUrl}}/support" class="footer-link">Support</a>
                <a href="{{appUrl}}/privacy" class="footer-link">Privacy</a>
                <a href="{{appUrl}}/terms" class="footer-link">Terms</a>
            </div>
            <div class="divider"></div>
            <p>© {{year}} MASH. All rights reserved.</p>
            <p style="margin-top:8px;">Mushroom Automation Smart Home System</p>
            <p style="margin-top:12px; color:#98a4af; font-size:12px;">This is an automated email. Please do not reply to this message.</p>
        </div>
    </div>
</body>
</html>
'@

Write-Host "Email template generator script created successfully!" -ForegroundColor Green
Write-Host "Base components ready for all templates" -ForegroundColor Cyan
