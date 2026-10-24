import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

const BRAND_BLUE = '#0075B4';
const BRAND_GRAY = '#878787';
const BRAND_GRAY_LIGHT = '#F4F6F9';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Layout minimo y seguro para la mayoria de los clientes de correo: una sola
// tabla, estilos inline, sin fuentes ni imagenes externas.
function emailLayout(title: string, bodyHtml: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND_GRAY_LIGHT}; padding:24px 0;">
  <tr>
    <td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:8px; overflow:hidden; font-family:Arial,Helvetica,sans-serif;">
        <tr>
          <td style="background:${BRAND_BLUE}; padding:20px 28px;">
            <span style="color:#ffffff; font-size:18px; font-weight:bold;">Kubero</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px;">
            <h2 style="margin:0 0 16px; color:#222222; font-size:18px;">${title}</h2>
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 28px; border-top:1px solid #eeeeee;">
            <span style="color:${BRAND_GRAY}; font-size:12px;">Kubero · Plataforma CI/CD educativa</span>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | undefined;

  constructor() {
    const { SMTP_HOST, SMTP_USER, SMTP_PASSWORD } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASSWORD) {
      this.logger.warn(
        'SMTP no configurado (faltan SMTP_HOST/SMTP_USER/SMTP_PASSWORD): no se enviarán correos.',
      );
      return;
    }
    this.transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
    });
  }

  // best-effort: que falle el envío no debe romper el cambio de contraseña
  async sendPasswordChangedEmail(
    to: string | undefined | null,
    displayName: string,
  ): Promise<void> {
    if (!this.transporter || !to) {
      return;
    }
    const safeDisplayName = escapeHtml(displayName);
    const text =
      `Hola ${displayName},\n\n` +
      'Te avisamos que la contraseña de tu cuenta de Kubero fue cambiada exitosamente. ' +
      'Si no fuiste tú, contacta a un administrador de la plataforma.\n\n' +
      '— Kubero';
    const html = emailLayout(
      'Tu contraseña fue cambiada',
      `<p style="margin:0 0 12px; color:#444444; font-size:14px; line-height:1.5;">Hola <strong>${safeDisplayName}</strong>,</p>
       <p style="margin:0 0 12px; color:#444444; font-size:14px; line-height:1.5;">Te avisamos que la contraseña de tu cuenta de Kubero fue cambiada exitosamente.</p>
       <p style="margin:0; color:#444444; font-size:14px; line-height:1.5;">Si no fuiste tú, contacta a un administrador de la plataforma lo antes posible.</p>`,
    );
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: 'Tu contraseña de Kubero fue cambiada',
        text,
        html,
      });
      this.logger.debug(`Correo de cambio de contraseña enviado a ${to}`);
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el correo de cambio de contraseña a ${to}`,
        error,
      );
    }
  }

  // best-effort: que falle el envío no debe romper el flujo de "olvidé mi
  // contraseña" (la respuesta al usuario es siempre la misma, exista o no
  // la cuenta, así que un fallo de envío no debe filtrarse tampoco).
  async sendPasswordResetEmail(
    to: string,
    displayName: string,
    resetUrl: string,
  ): Promise<void> {
    if (!this.transporter) {
      return;
    }
    const safeDisplayName = escapeHtml(displayName);
    const safeResetUrl = escapeHtml(resetUrl);
    const text =
      `Hola ${displayName},\n\n` +
      'Pediste restablecer la contraseña de tu cuenta de Kubero. Entra al siguiente link para elegir una nueva (vence en 30 minutos):\n\n' +
      `${resetUrl}\n\n` +
      'Si no fuiste tú, puedes ignorar este correo — tu contraseña actual sigue funcionando.\n\n' +
      '— Kubero';
    const html = emailLayout(
      'Restablecer tu contraseña',
      `<p style="margin:0 0 12px; color:#444444; font-size:14px; line-height:1.5;">Hola <strong>${safeDisplayName}</strong>,</p>
       <p style="margin:0 0 20px; color:#444444; font-size:14px; line-height:1.5;">Pediste restablecer la contraseña de tu cuenta de Kubero. El siguiente enlace vence en 30 minutos:</p>
       <p style="margin:0 0 20px;"><a href="${safeResetUrl}" style="background:${BRAND_BLUE}; color:#ffffff; text-decoration:none; padding:10px 20px; border-radius:6px; font-size:14px; display:inline-block;">Elegir nueva contraseña</a></p>
       <p style="margin:0; color:#444444; font-size:14px; line-height:1.5;">Si no fuiste tú, puedes ignorar este correo — tu contraseña actual sigue funcionando.</p>`,
    );
    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject: 'Restablece tu contraseña de Kubero',
        text,
        html,
      });
      this.logger.debug(
        `Correo de restablecimiento de contraseña enviado a ${to}`,
      );
    } catch (error) {
      this.logger.error(
        `No se pudo enviar el correo de restablecimiento de contraseña a ${to}`,
        error,
      );
    }
  }
}
