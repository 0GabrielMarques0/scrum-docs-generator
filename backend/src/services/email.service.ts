import nodemailer from 'nodemailer';

// Gmail SMTP configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD, // Use App Password, not regular password
  },
});

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  // If email is not configured, just log and return
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.log('[EMAIL] Not configured. Would send to:', to);
    console.log('[EMAIL] Subject:', subject);
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"SpecAI" <${process.env.GMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log('[EMAIL] Sent successfully to:', to);
    return true;
  } catch (error) {
    console.error('[EMAIL] Error sending:', error);
    return false;
  }
}

export async function sendTemporaryPasswordEmail(
  to: string,
  userName: string,
  tempPassword: string
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .header h1 { color: white; margin: 0; font-size: 24px; }
        .content { background: #f8fafc; padding: 30px; border: 1px solid #e2e8f0; }
        .password-box { background: white; border: 2px dashed #6366f1; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px; }
        .password { font-size: 24px; font-weight: bold; color: #6366f1; letter-spacing: 2px; font-family: monospace; }
        .footer { background: #1e293b; color: #94a3b8; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Recuperação de Senha</h1>
        </div>
        <div class="content">
          <p>Olá <strong>${userName}</strong>,</p>
          <p>Recebemos uma solicitação para redefinir sua senha no SpecAI.</p>
          <p>Sua senha provisória é:</p>
          <div class="password-box">
            <span class="password">${tempPassword}</span>
          </div>
          <div class="warning">
            <strong>⚠️ Importante:</strong> Por segurança, altere sua senha assim que fizer login.
          </div>
          <p>Se você não solicitou esta alteração, ignore este email.</p>
        </div>
        <div class="footer">
          <p>SpecAI - Gerador de Documentação Scrum</p>
          <p>Este é um email automático, não responda.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: '🔐 SpecAI - Sua Senha Provisória',
    html,
  });
}
