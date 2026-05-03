// <== IMPORTS ==>
import {
  phoneChangeTemplate,
  emailChangeNewTemplate,
  passwordChangeTemplate,
  emailChangeCurrentTemplate,
} from "./emailTemplates.js";

// <== BREVO TRANSACTIONAL EMAIL API URL ==>
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";

// <== HELPER: SEND EMAIL VIA BREVO REST API ==>
const sendEmail = async ({ to, toName, subject, htmlContent }) => {
  // MAKING REQUEST TO BREVO TRANSACTIONAL EMAIL API
  const response = await fetch(BREVO_API_URL, {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": process.env.BREVO_API_KEY,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: {
        name: process.env.BREVO_SENDER_NAME || "Milk Shop Management",
        email: process.env.BREVO_SENDER_EMAIL,
      },
      to: [{ email: to, name: toName || to }],
      subject,
      htmlContent,
    }),
  });
  // IF REQUEST FAILED — THROW WITH BREVO ERROR MESSAGE
  if (!response.ok) {
    // TRY TO EXTRACT ERROR MESSAGE FROM BREVO RESPONSE
    const errorData = await response.json().catch(() => ({}));
    // THROW ERROR WITH BREVO MESSAGE OR GENERIC ERROR IF BREVO MESSAGE IS UNAVAILABLE
    throw new Error(
      errorData.message ||
        `Email delivery failed with Brevo status ${response.status}`,
    );
  }
};

/**
 * SEND PASSWORD CHANGE OTP TO USER'S CURRENT EMAIL
 */
// <== SEND PASSWORD CHANGE OTP ==>
export const sendPasswordChangeOtp = async ({ to, fullName, code }) => {
  // SENDING PASSWORD CHANGE VERIFICATION EMAIL
  await sendEmail({
    to,
    toName: fullName,
    subject: "Security Code — Password Change Request",
    htmlContent: passwordChangeTemplate({ fullName, code }),
  });
};

/**
 * SEND PHONE NUMBER CHANGE OTP TO USER'S CURRENT EMAIL
 */
// <== SEND PHONE CHANGE OTP ==>
export const sendPhoneChangeOtp = async ({ to, fullName, code, newPhone }) => {
  // SENDING PHONE NUMBER CHANGE VERIFICATION EMAIL
  await sendEmail({
    to,
    toName: fullName,
    subject: "Security Code — Phone Number Update",
    htmlContent: phoneChangeTemplate({ fullName, code, newPhone }),
  });
};

/**
 * SEND EMAIL CHANGE IDENTITY VERIFICATION CODE TO CURRENT EMAIL (STEP 1)
 */
// <== SEND EMAIL CHANGE CURRENT OTP ==>
export const sendEmailChangeCurrentOtp = async ({
  to,
  fullName,
  code,
  newEmail,
}) => {
  // SENDING IDENTITY VERIFICATION EMAIL TO CURRENT EMAIL ADDRESS
  await sendEmail({
    to,
    toName: fullName,
    subject: "Security Code — Confirm Your Identity",
    htmlContent: emailChangeCurrentTemplate({ fullName, code, newEmail }),
  });
};

/**
 * SEND EMAIL CHANGE OWNERSHIP VERIFICATION CODE TO NEW EMAIL (STEP 2)
 */
// <== SEND EMAIL CHANGE NEW OTP ==>
export const sendEmailChangeNewOtp = async ({ to, fullName, code }) => {
  // SENDING NEW EMAIL VERIFICATION CODE TO THE NEW EMAIL ADDRESS
  await sendEmail({
    to,
    toName: fullName,
    subject: "Security Code — Verify Your New Email Address",
    htmlContent: emailChangeNewTemplate({ fullName, code }),
  });
};
