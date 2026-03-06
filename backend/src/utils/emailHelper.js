import nodemailer from 'nodemailer';
import { Resend } from 'resend';

// Unified email sender: uses Resend (HTTP) if configured, falls back to SMTP
export const sendEmail = async ({ from, to, subject, html }) => {
  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const { data, error } = await resend.emails.send({
      from: from || process.env.EMAIL_FROM || 'noreply@larealmarketing.com',
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });
    if (error) throw new Error(`Resend error: ${error.message}`);
    return data;
  }

  // Fallback: SMTP via nodemailer
  const transporter = getEmailTransporter();
  return await transporter.sendMail({ from, to, subject, html });
};

export const getEmailTransporter = () => {
  const port = parseInt(process.env.EMAIL_PORT || '465', 10);
  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port,
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

export const sendWelcomeEmail = async ({ to, memberName, email, pin, orgName, loginUrl }) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#ffffff;border-radius:12px;overflow:hidden;">
              <!-- Header -->
              <tr>
                <td style="background-color:#1A1A2E;padding:32px 40px;text-align:center;">
                  <h1 style="color:#BFFF00;margin:0;font-size:22px;font-weight:700;">
                    ${orgName}
                  </h1>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:40px;">
                  <h2 style="color:#1A1A2E;margin:0 0 8px;font-size:20px;">
                    Hola ${memberName},
                  </h2>
                  <p style="color:#6b7280;margin:0 0 28px;font-size:15px;line-height:1.6;">
                    Has sido invitado/a al equipo de <strong>${orgName}</strong>. A continuación encontrarás tus credenciales de acceso.
                  </p>

                  <!-- Credentials Box -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;margin-bottom:28px;">
                    <tr>
                      <td style="padding:24px;">
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding-bottom:14px;">
                              <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Email</span><br>
                              <span style="color:#1A1A2E;font-size:16px;font-weight:600;">${email}</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="border-top:1px solid #e5e7eb;padding-top:14px;">
                              <span style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">PIN de acceso</span><br>
                              <span style="color:#1A1A2E;font-size:20px;font-weight:700;letter-spacing:2px;">${pin}</span>
                            </td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>

                  <!-- CTA Button -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td align="center">
                        <a href="${loginUrl}" style="display:inline-block;background-color:#1A1A2E;color:#BFFF00;text-decoration:none;padding:14px 36px;border-radius:10px;font-size:15px;font-weight:600;">
                          Iniciar Sesión
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center;">
                  <p style="color:#9ca3af;margin:0;font-size:12px;">
                    Este email fue enviado automáticamente por ${orgName}.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  await sendEmail({
    from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
    to,
    subject: `Bienvenido/a al equipo de ${orgName}`,
    html,
  });
};
