const env = require("../config/env");

const formatSender = () => `"${env.EMAIL_FROM_NAME}" <${env.EMAIL_FROM_ADDRESS}>`;

const isSmtpConfigured = () => Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

const isResendConfigured = () => Boolean(env.RESEND_API_KEY);

const logEmailPreview = ({ to, subject, html }) => {
  console.info("[email/preview]", {
    to,
    subject,
    from: formatSender(),
    html
  });
};

const sendWithResend = async ({ to, subject, html }) => {
  const { Resend } = require("resend");
  const resend = new Resend(env.RESEND_API_KEY);
  await resend.emails.send({
    from: formatSender(),
    to,
    subject,
    html
  });
};

const sendWithSmtp = async ({ to, subject, html }) => {
  const nodemailer = require("nodemailer");
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: Number(env.SMTP_PORT) === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: formatSender(),
    to,
    subject,
    html
  });
};

const sendEmail = async ({ to, subject, html }) => {
  try {
    const provider = env.EMAIL_PROVIDER || "smtp";
    const configured = provider === "resend" ? isResendConfigured() : isSmtpConfigured();

    if (!configured) {
      if (env.NODE_ENV !== "production") {
        logEmailPreview({ to, subject, html });
        return { sent: false, provider, preview: html };
      }

      const error = `${provider} email provider is not configured`;
      console.error("[email/send] configuration error", { provider, to, subject, error });
      return { sent: false, provider, error };
    }

    if (provider === "resend") {
      await sendWithResend({ to, subject, html });
      return { sent: true, provider };
    }

    await sendWithSmtp({ to, subject, html });
    return { sent: true, provider };
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    console.error("[email/send] failed", {
      to,
      subject,
      error: message
    });
    return { sent: false, provider: env.EMAIL_PROVIDER || "smtp", error: message };
  }
};

module.exports = {
  sendEmail
};
