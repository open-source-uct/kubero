import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

const K8S_QUANTITY_REGEX =
  /^[+]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?(m|k|M|G|T|P|E|Ki|Mi|Gi|Ti|Pi|Ei)?$/;

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
