// <== BASE EMAIL LAYOUT WRAPPER ==>
const baseLayout = ({ title, preheader, bodyContent }) => `
    <!DOCTYPE html>
    <html lang="en">
    <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>${title}</title>
    </head>
    <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
    <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${preheader}&nbsp;&zwnj;&nbsp;</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f1f5f9;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;">
          <!-- HEADER BAND -->
          <tr>
            <td style="background:linear-gradient(135deg,#6366f1 0%,#7c3aed 100%);padding:28px 40px;text-align:center;border-radius:16px 16px 0 0;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                <tr>
                  <td style="padding-right:10px;vertical-align:middle;">
                    <div style="width:38px;height:38px;background:rgba(255,255,255,0.2);border-radius:50%;text-align:center;line-height:38px;font-size:20px;display:inline-block;">🥛</div>
                  </td>
                  <td style="vertical-align:middle;">
                    <span style="color:#ffffff;font-size:19px;font-weight:700;letter-spacing:-0.3px;">Milk Shop</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- CARD BODY -->
          <tr>
            <td style="background-color:#ffffff;padding:40px 40px 36px;border-left:1px solid #e2e8f0;border-right:1px solid #e2e8f0;">
              ${bodyContent}
            </td>
          </tr>
          <!-- FOOTER -->
          <tr>
            <td style="background-color:#f8fafc;padding:22px 40px;text-align:center;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 16px 16px;">
              <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.7;">
                This is an automated security email from <strong style="color:#64748b;">Milk Shop Management System</strong>.<br/>
                If you did not request this action, your account is safe — please ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    </table>
    </body>
    </html>`;

// <== OTP CODE DISPLAY BLOCK ==>
const otpBlock = (code) =>
  `<div style="text-align:center;margin:28px 0 24px;">
        <div style="display:inline-block;background-color:#fafafa;border:2px dashed #6366f1;border-radius:14px;padding:22px 44px;">
        <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#94a3b8;">Your Security Code</p>
        <p style="margin:0;font-size:44px;font-weight:900;letter-spacing:12px;color:#6366f1;font-family:'Courier New',Courier,monospace;line-height:1.1;">${code}</p>
        </div>
        <p style="margin:14px 0 0;font-size:13px;color:#ef4444;font-weight:600;">⏱&nbsp; Expires in 10 minutes</p>
    </div>`;

// <== PASSWORD CHANGE VERIFICATION TEMPLATE ==>
export const passwordChangeTemplate = ({ fullName, code }) =>
  baseLayout({
    title: "Security Code — Password Change",
    preheader: `Your security code is ${code}. Valid for 10 minutes.`,
    bodyContent: `<h1 style="margin:0 0 10px;font-size:23px;font-weight:800;color:#0f172a;text-align:center;letter-spacing:-0.3px;">Password Change Request</h1>
      <p style="margin:0 0 6px;text-align:center;color:#64748b;font-size:15px;">Hi <strong style="color:#0f172a;">${fullName}</strong>,</p>
      <p style="margin:0;text-align:center;color:#64748b;font-size:15px;line-height:1.7;">
        We received a request to change your account password.<br/>Use the code below to confirm this action.
      </p>
      ${otpBlock(code)}
      <div style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 18px;text-align:center;">
        <p style="margin:0;color:#c2410c;font-size:13px;line-height:1.6;">
          <strong>⚠ Did not request this?</strong> Contact support immediately — someone may be attempting to access your account.
        </p>
    </div>`,
  });

// <== PHONE CHANGE VERIFICATION TEMPLATE ==>
export const phoneChangeTemplate = ({ fullName, code, newPhone }) =>
  baseLayout({
    title: "Security Code — Phone Number Update",
    preheader: `Your security code is ${code}. Valid for 10 minutes.`,
    bodyContent: `<h1 style="margin:0 0 10px;font-size:23px;font-weight:800;color:#0f172a;text-align:center;letter-spacing:-0.3px;">Phone Number Update</h1>
      <p style="margin:0 0 6px;text-align:center;color:#64748b;font-size:15px;">Hi <strong style="color:#0f172a;">${fullName}</strong>,</p>
      <p style="margin:0;text-align:center;color:#64748b;font-size:15px;line-height:1.7;">
        A request was made to update your phone number to<br/><strong style="color:#0f172a;">${newPhone}</strong>.<br/>Enter the code below to confirm this change.
      </p>
      ${otpBlock(code)}
      <p style="margin:0;text-align:center;color:#94a3b8;font-size:13px;line-height:1.6;">
        Did not request this? Your account is safe — simply ignore this email and no changes will be made.
    </p>`,
  });

// <== EMAIL CHANGE — CURRENT EMAIL VERIFICATION TEMPLATE ==>
export const emailChangeCurrentTemplate = ({ fullName, code, newEmail }) =>
  baseLayout({
    title: "Security Code — Confirm Your Identity",
    preheader: `Your security code is ${code}. Valid for 10 minutes.`,
    bodyContent: `<h1 style="margin:0 0 10px;font-size:23px;font-weight:800;color:#0f172a;text-align:center;letter-spacing:-0.3px;">Confirm Your Identity</h1>
      <p style="margin:0 0 6px;text-align:center;color:#64748b;font-size:15px;">Hi <strong style="color:#0f172a;">${fullName}</strong>,</p>
      <p style="margin:0;text-align:center;color:#64748b;font-size:15px;line-height:1.7;">
        You've requested to change your email address to<br/><strong style="color:#0f172a;">${newEmail}</strong>.<br/>
        First, let's confirm your identity with this code.
      </p>
      ${otpBlock(code)}
      <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 18px;text-align:center;">
        <p style="margin:0;color:#1d4ed8;font-size:13px;line-height:1.6;">
          ℹ After verifying this code, a second code will be sent to your <strong>new email address</strong> to confirm ownership.
        </p>
    </div>`,
  });

// <== EMAIL CHANGE — NEW EMAIL VERIFICATION TEMPLATE ==>
export const emailChangeNewTemplate = ({ fullName, code }) =>
  baseLayout({
    title: "Security Code — Verify Your New Email",
    preheader: `Your security code is ${code}. Valid for 10 minutes.`,
    bodyContent: `<h1 style="margin:0 0 10px;font-size:23px;font-weight:800;color:#0f172a;text-align:center;letter-spacing:-0.3px;">Verify Your New Email</h1>
      <p style="margin:0 0 6px;text-align:center;color:#64748b;font-size:15px;">Hi <strong style="color:#0f172a;">${fullName}</strong>,</p>
      <p style="margin:0;text-align:center;color:#64748b;font-size:15px;line-height:1.7;">
        Your identity has been verified ✓<br/>
        Now confirm this is your new email address by entering the code below.<br/>
        Once confirmed, your email will be updated immediately.
      </p>
      ${otpBlock(code)}
      <div style="background-color:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 18px;text-align:center;">
        <p style="margin:0;color:#15803d;font-size:13px;font-weight:600;">
          ✓ Your new email address will be active immediately after verification
        </p>
    </div>`,
  });

// <== FORGOT PASSWORD VERIFICATION TEMPLATE ==>
export const forgotPasswordTemplate = ({ fullName, code }) =>
  baseLayout({
    title: "Security Code — Password Reset",
    preheader: `Your password reset code is ${code}. Valid for 10 minutes.`,
    bodyContent: `<h1 style="margin:0 0 10px;font-size:23px;font-weight:800;color:#0f172a;text-align:center;letter-spacing:-0.3px;">Password Reset Request</h1>
      <p style="margin:0 0 6px;text-align:center;color:#64748b;font-size:15px;">Hi <strong style="color:#0f172a;">${fullName}</strong>,</p>
      <p style="margin:0;text-align:center;color:#64748b;font-size:15px;line-height:1.7;">
        We received a request to reset the password for your Milk Shop account.<br/>Use the code below to continue. If you did not request this, you can safely ignore this email.
      </p>
      ${otpBlock(code)}
      <div style="background-color:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:14px 18px;text-align:center;">
        <p style="margin:0;color:#c2410c;font-size:13px;line-height:1.6;">
          <strong>⚠ Did not request this?</strong> Your account is safe — no changes will be made unless this code is entered.
        </p>
      </div>`,
  });

// <== ACCOUNT INVITE TEMPLATE ==>
export const inviteTemplate = ({ fullName, code, role, setupUrl }) =>
  baseLayout({
    title: "You've Been Invited — Complete Your Account Setup",
    preheader: `Your setup code is ${code}. Valid for 48 hours.`,
    bodyContent: `<h1 style="margin:0 0 10px;font-size:23px;font-weight:800;color:#0f172a;text-align:center;letter-spacing:-0.3px;">You've Been Invited!</h1>
      <p style="margin:0 0 6px;text-align:center;color:#64748b;font-size:15px;">Hi <strong style="color:#0f172a;">${fullName}</strong>,</p>
      <p style="margin:0;text-align:center;color:#64748b;font-size:15px;line-height:1.7;">
        You've been added to a Milk Shop Management account as
        <strong style="color:#0f172a;">${role === "admin" ? "an Admin" : "a Team Member"}</strong>.<br/>
        Click the button below to get started, then enter the code from this email.
      </p>
      <div style="text-align:center;margin:26px 0 22px;">
        <a href="${setupUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1 0%,#7c3aed 100%);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 38px;border-radius:10px;">Complete Account Setup →</a>
      </div>
      <div style="text-align:center;margin:0 0 24px;">
        <div style="display:inline-block;background-color:#fafafa;border:2px dashed #6366f1;border-radius:14px;padding:22px 44px;">
          <p style="margin:0 0 8px;font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:#94a3b8;">Your Setup Code</p>
          <p style="margin:0;font-size:44px;font-weight:900;letter-spacing:12px;color:#6366f1;font-family:'Courier New',Courier,monospace;line-height:1.1;">${code}</p>
        </div>
        <p style="margin:14px 0 0;font-size:13px;color:#ef4444;font-weight:600;">⏱&nbsp; Expires in 48 hours</p>
      </div>
      <div style="background-color:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 18px;text-align:center;margin-bottom:16px;">
        <p style="margin:0;color:#1d4ed8;font-size:13px;line-height:1.6;word-break:break-all;">
          ℹ If the button does not work, copy and paste this link into your browser:<br/>
          <a href="${setupUrl}" style="color:#1d4ed8;">${setupUrl}</a>
        </p>
      </div>
      <p style="margin:0;text-align:center;color:#94a3b8;font-size:13px;line-height:1.6;">
        Did not expect this invite? You can safely ignore this email — no account will be created without completing the setup.
      </p>`,
  });
