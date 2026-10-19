import { ValidationPipe } from '@nestjs/common';

// whitelist: descarta del body todo campo que el DTO no declare, para que un
// service que pase el objeto a Prisma no pueda recibir relaciones ni columnas
// que nadie pensó exponer. No se usa forbidNonWhitelisted porque el cliente
// reenvía objetos completos (id, createdAt...) y eso devolvería 400.
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({ transform: true, whitelist: true });
}
