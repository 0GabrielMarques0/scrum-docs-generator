import { Resend } from 'resend';
import { escapeHtml } from '../utils/validation.js';

// Initialize Resend (will be null if not configured)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  if (!resend) {
    console.log('[EMAIL] Resend not configured, email not sent');
    return false;
  }

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const { error } = await resend.emails.send({
      from: `SpecAI <${fromEmail}>`,
      to: [to],
      subject,
      html,
    });
    if (error) {
      console.error('[EMAIL] Error sending:', error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error('[EMAIL] Error sending:', error);
    return false;
  }
}

export async function sendPasswordResetEmail(to: string, userName: string, resetUrl: string): Promise<boolean> {
  const safeName = escapeHtml(userName);
  const safeUrl = escapeHtml(resetUrl);

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
        .button { display: inline-block; background: #6366f1; color: white !important; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: bold; }
        .footer { background: #1e293b; color: #94a3b8; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 12px; }
        .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
        .link { word-break: break-all; font-size: 12px; color: #64748b; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Redefinição de Senha</h1>
        </div>
        <div class="content">
          <p>Olá <strong>${safeName}</strong>,</p>
          <p>Recebemos uma solicitação para redefinir sua senha no SpecAI. Clique no botão abaixo para escolher uma nova senha:</p>
          <p style="text-align: center; margin: 30px 0;">
            <a class="button" href="${safeUrl}">Redefinir minha senha</a>
          </p>
          <p class="link">Ou copie e cole no navegador: ${safeUrl}</p>
          <div class="warning">
            <strong>⚠️ Importante:</strong> este link expira em 1 hora e só pode ser usado uma vez.
          </div>
          <p>Se você não solicitou esta alteração, ignore este email — sua senha atual continua válida.</p>
        </div>
        <div class="footer">
          <p>SpecAI - Gerador de Documentação Scrum</p>
          <p>Este é um email automático, não responda.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({ to, subject: '🔐 SpecAI - Redefinição de senha', html });
}
