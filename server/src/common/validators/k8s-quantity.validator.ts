import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

const K8S_QUANTITY_REGEX =
  /^[+]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?(m|k|M|G|T|P|E|Ki|Mi|Gi|Ti|Pi|Ei)?$/;

const QUANTITY_SUFFIX: Record<string, number> = {
  '': 1,
  m: 1e-3,
  k: 1e3,
  M: 1e6,
  G: 1e9,
  T: 1e12,
  P: 1e15,
  E: 1e18,
  Ki: 2 ** 10,
  Mi: 2 ** 20,
  Gi: 2 ** 30,
  Ti: 2 ** 40,
  Pi: 2 ** 50,
  Ei: 2 ** 60,
};

// Cantidad de Kubernetes a número (núcleos para CPU, bytes para memoria);
// null si no es una cantidad válida
export function parseK8sQuantity(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = K8S_QUANTITY_REGEX.exec(value.trim());
  if (!match) return null;
  const [, number, , exponent, suffix = ''] = match;
  const power = exponent ? Number(exponent.slice(1)) : 0;
  return Number(number) * 10 ** power * QUANTITY_SUFFIX[suffix];
}

export function IsK8sQuantity(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isK8sQuantity',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          return (
            typeof value === 'string' && K8S_QUANTITY_REGEX.test(value.trim())
          );
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid Kubernetes resource quantity (e.g. "250m", "0.5", "512Mi", "1Gi"), got "${args.value}"`;
        },
      },
    });
  };
}
