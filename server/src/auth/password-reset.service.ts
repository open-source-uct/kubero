import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';
import { MailService } from '../mail/mail.service';
import { UsersService } from '../users/users.service';
import { displayNameOf } from '../common/utils/display-name.util';
import { PasswordResetThrottleService } from './password-reset-throttle.service';
import { AuditService } from '../audit/audit.service';

const TOKEN_TTL_MS = 30 * 60 * 1000; // 30 minutos
// Piso de tiempo de respuesta para requestReset: sin esto, un correo que sí
// existe tarda más (dos escrituras extra en la base) que uno que no existe,
// y ese tiempo de más delata qué correos están registrados aunque la
// respuesta HTTP sea idéntica en ambos casos.
const MIN_REQUEST_RESET_MS = 300;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);
  private readonly prisma = new PrismaClient();

  constructor(
    private readonly mailService: MailService,
    private readonly usersService: UsersService,
    private readonly throttle: PasswordResetThrottleService,
    private readonly auditService: AuditService,
  ) {}

  // Pedidos y restablecimientos quedan en la auditoría (solo los ve el admin).
  // Antes no había registro: un pedido hecho por otra persona no se podía
  // rastrear. Va sin esperar, para no alterar el piso de tiempo de respuesta.
  private audit(action: string, message: string, userId = '1'): void {
    void this.auditService.log({
      user: userId,
      severity: 'warning',
      action,
      resource: 'security',
      namespace: '',
      phase: '',
      app: '',
      pipeline: '',
      message,
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // Responde siempre lo mismo (ver el controller) exista o no el correo, sea
  // o no una cuenta local, o esté activa o no — así nadie puede usar este
  // endpoint para averiguar qué cuentas existen en la plataforma. El piso de
  // tiempo de abajo cubre el mismo objetivo pero por el lado del timing: sin
  // él, un correo que existe tarda más (dos escrituras extra) que uno que no,
  // y esa diferencia delata cuentas aunque la respuesta HTTP sea idéntica.
  async requestReset(email: string, ip: string): Promise<void> {
    this.throttle.assertAllowed(ip, email);
    this.throttle.record(ip, email);

    const baseUrl = process.env.KUBERO_URL;
    if (!baseUrl) {
      this.logger.warn(
        'KUBERO_URL no está configurado: no se puede armar el link de restablecimiento de contraseña.',
      );
      return;
    }

    const start = Date.now();
    await this.doRequestReset(email.trim().toLowerCase(), baseUrl, ip);
    const elapsed = Date.now() - start;
    if (elapsed < MIN_REQUEST_RESET_MS) {
      await sleep(MIN_REQUEST_RESET_MS - elapsed);
    }
  }

  private async doRequestReset(
    email: string,
    baseUrl: string,
    ip: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Los usuarios de GitHub/OAuth2 no tienen una contraseña real (se les
    // asigna una aleatoria que nunca usan, entran por el proveedor externo);
    // restablecerla no les serviría de nada y les abriría un login local que
    // no debería existir para esa cuenta.
    if (!user || !user.isActive || user.provider !== 'local') {
      return;
    }

    // Solo el último pedido de reseteo queda vigente.
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: user.id, usedAt: null },
    });

    const rawToken = crypto.randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(rawToken),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
      },
    });

    const resetUrl = `${baseUrl.replace(/\/+$/, '')}/reset-password?token=${rawToken}`;
    // el usuario de la entrada es el sistema: quien pide el restablecimiento
    // no tiene por qué ser el dueño de la cuenta
    this.audit(
      'password-reset-requested',
      `Se pidió restablecer la contraseña de ${user.username} (IP ${ip})`,
    );
    void this.mailService.sendPasswordResetEmail(
      user.email,
      displayNameOf(user),
      resetUrl,
    );
  }

  async resetPassword(
    token: string,
    newPassword: string,
    ip: string,
  ): Promise<void> {
    // Clave liviana solo para frenar automatización masiva; con 32 bytes de
    // entropía adivinar un token por fuerza bruta ya es inviable igual.
    this.throttle.assertAllowed(ip, `token-attempt:${ip}`);
    this.throttle.record(ip, `token-attempt:${ip}`);

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashToken(token) },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException(
        'El enlace de restablecimiento no es válido o ya expiró',
      );
    }

    // Se marca usado antes de aplicar el cambio: si algo falla después, el
    // token no queda reutilizable.
    await this.prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    const updated = await this.usersService.updatePassword(
      record.userId,
      newPassword,
    );
    if (!updated) {
      throw new BadRequestException('No se pudo actualizar la contraseña');
    }
    this.audit(
      'password-reset-completed',
      `Se restableció la contraseña con un enlace enviado por correo (IP ${ip})`,
      record.userId,
    );
  }
}
