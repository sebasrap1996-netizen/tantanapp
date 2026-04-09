import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    const port = this.configService.get('EMAIL_PORT');
    this.transporter = nodemailer.createTransport({
      host: this.configService.get('EMAIL_HOST'),
      port: port,
      secure: port === 465, // SSL para puerto 465, TLS para otros
      auth: {
        user: this.configService.get('EMAIL_USER'),
        pass: this.configService.get('EMAIL_PASS'),
      },
    });
  }

  async sendPasswordResetCode(email: string, code: string): Promise<void> {
    const mailOptions = {
      from: this.configService.get('EMAIL_FROM'),
      to: email,
      subject: `Codigo de Recuperacion de Contrasena - ${this.configService.get('APP_NAME') || 'Hacks Casino'}`,
      html: `
        <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px;">
              <span style="font-size: 24px; font-weight: 700; color: white;">${(this.configService.get('APP_NAME') || 'Hacks Casino').toUpperCase()}</span>
            </div>
          </div>

          <div style="height: 1px; background: #e5e7eb; margin: 24px 0;"></div>

          <h2 style="color: #111827; font-size: 20px; font-weight: 600; margin: 0 0 16px 0; text-align: center;">
            Verifica tu correo electrónico
          </h2>

          <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
            Para continuar con el proceso de recuperación de contraseña, ingresa el siguiente código en la ventana original.
          </p>

          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <div style="font-size: 36px; font-weight: 700; color: #10b981; letter-spacing: 8px; font-family: 'SF Mono', Monaco, 'Courier New', monospace;">
              ${code}
            </div>
          </div>

          <p style="color: #9ca3af; font-size: 13px; text-align: center; margin: 24px 0;">
            Si no solicitaste este código, puedes ignorar este correo de forma segura.
          </p>

          <div style="height: 1px; background: #e5e7eb; margin: 24px 0;"></div>

          <div style="text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              ${this.configService.get('APP_NAME') || 'Hacks Casino'}, Singapore 018956<br>
              Singapore
            </p>
          </div>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error enviando email:', error);
      throw new Error('No se pudo enviar el email');
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Error en conexión de email:', error);
      return false;
    }
  }

  async sendLicenseApprovedEmail(
    email: string,
    productName: string,
    licenseCode: string,
    days: number,
    amount: number
  ): Promise<void> {
    const mailOptions = {
      from: this.configService.get('EMAIL_FROM'),
      to: email,
      subject: `Tu Licencia ha sido Activada - ${this.configService.get('APP_NAME') || 'Hacks Casino'}`,
      html: `
        <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px;">
              <span style="font-size: 24px; font-weight: 700; color: white;">${(this.configService.get('APP_NAME') || 'Hacks Casino').toUpperCase()}</span>
            </div>
          </div>

          <div style="height: 1px; background: #e5e7eb; margin: 24px 0;"></div>

          <h2 style="color: #111827; font-size: 20px; font-weight: 600; margin: 0 0 16px 0; text-align: center;">
            Tu licencia ha sido activada
          </h2>

          <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
            Tu pago ha sido confirmado y tu licencia está ahora activa.
          </p>

          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Producto</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${productName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Duración</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${days} días</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Monto Pagado</td>
                <td style="padding: 8px 0; color: #10b981; font-size: 14px; font-weight: 700; text-align: right;">$${amount} USD</td>
              </tr>
            </table>
          </div>

          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
            <p style="color: #166534; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Tu Código de Licencia</p>
            <div style="font-size: 24px; font-weight: 700; color: #10b981; letter-spacing: 2px; font-family: 'SF Mono', Monaco, 'Courier New', monospace; word-break: break-all;">
              ${licenseCode}
            </div>
          </div>

          <p style="color: #9ca3af; font-size: 13px; text-align: center; margin: 24px 0;">
            Guarda este código de licencia. Lo necesitarás para activar tu cuenta en la plataforma.
          </p>

          <div style="height: 1px; background: #e5e7eb; margin: 24px 0;"></div>

          <div style="text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              ${this.configService.get('APP_NAME') || 'Hacks Casino'}, Singapore 018956<br>
              Singapore
            </p>
          </div>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error enviando email de licencia:', error);
      throw new Error('No se pudo enviar el email de licencia');
    }
  }

  async sendOrderRejectedEmail(
    email: string,
    productName: string,
    reason: string
  ): Promise<void> {
    const mailOptions = {
      from: this.configService.get('EMAIL_FROM'),
      to: email,
      subject: `Tu Pago ha sido Rechazado - ${this.configService.get('APP_NAME') || 'Hacks Casino'}`,
      html: `
        <div style="max-width: 480px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px 20px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; padding: 12px 24px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px;">
              <span style="font-size: 24px; font-weight: 700; color: white;">${(this.configService.get('APP_NAME') || 'Hacks Casino').toUpperCase()}</span>
            </div>
          </div>

          <div style="height: 1px; background: #e5e7eb; margin: 24px 0;"></div>

          <h2 style="color: #111827; font-size: 20px; font-weight: 600; margin: 0 0 16px 0; text-align: center;">
            Tu pago ha sido rechazado
          </h2>

          <p style="color: #6b7280; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0; text-align: center;">
            Lamentamos informarte que tu pago no pudo ser procesado.
          </p>

          <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; margin: 24px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Producto</td>
                <td style="padding: 8px 0; color: #111827; font-size: 14px; font-weight: 600; text-align: right;">${productName}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 14px;">Motivo del rechazo</td>
                <td style="padding: 8px 0; color: #ef4444; font-size: 14px; font-weight: 600; text-align: right;">${reason}</td>
              </tr>
            </table>
          </div>

          <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 24px; margin: 24px 0;">
            <p style="color: #991b1b; font-size: 14px; margin: 0; line-height: 1.6;">
              <strong>¿Qué puedes hacer?</strong><br>
              Por favor, contacta nuestro soporte para más información o intenta realizar el pago nuevamente con otro método de pago.
            </p>
          </div>

          <div style="height: 1px; background: #e5e7eb; margin: 24px 0;"></div>

          <div style="text-align: center;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              ${this.configService.get('APP_NAME') || 'Hacks Casino'}, Singapore 018956<br>
              Singapore
            </p>
          </div>
        </div>
      `,
    };

    try {
      await this.transporter.sendMail(mailOptions);
    } catch (error) {
      console.error('Error enviando email de rechazo:', error);
      throw new Error('No se pudo enviar el email de rechazo');
    }
  }
}
