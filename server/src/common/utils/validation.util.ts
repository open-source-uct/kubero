import { ValidationError } from 'class-validator';

// class-validator anida los errores de campos dentro de objetos (ej.
// kubero.config.kubero.banner.bgcolor) bajo `error.children` en vez de
// ponerlos en `error.constraints`. Aplana recursivamente para no perder
// ninguno de los mensajes anidados.
export function flattenValidationErrors(errors: ValidationError[]): string[] {
  const messages: string[] = [];
  for (const error of errors) {
    if (error.constraints) {
      messages.push(...Object.values(error.constraints));
    }
    if (error.children && error.children.length > 0) {
      messages.push(...flattenValidationErrors(error.children));
    }
  }
  return messages;
}
