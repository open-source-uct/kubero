import { BadRequestException } from '@nestjs/common';
import { PodSize } from './podsize';
import { IPodSize } from '../config.interface';
import { assertRequestsWithinLimits } from './podsize.dto';
import { parseK8sQuantity } from '../../common/validators/k8s-quantity.validator';

const mockPodSize: IPodSize = {
  name: 'small',
  description: 'Small pod',
  default: true,
  active: true,
  resources: {
    requests: {
      memory: '256Mi',
      cpu: '250m',
    },
    limits: {
      memory: '512Mi',
      cpu: '500m',
    },
  },
};

describe('PodSize', () => {
  it('should be defined', () => {
    expect(new PodSize(mockPodSize)).toBeDefined();
  });
});

describe('parseK8sQuantity', () => {
  it('reads CPU and memory in any notation Kubernetes accepts', () => {
    expect(parseK8sQuantity('250m')).toBeCloseTo(0.25);
    expect(parseK8sQuantity('1')).toBe(1);
    expect(parseK8sQuantity('0.5Gi')).toBe(512 * 2 ** 20);
    expect(parseK8sQuantity('512Mi')).toBe(512 * 2 ** 20);
    expect(parseK8sQuantity('1e3')).toBe(1000);
    expect(parseK8sQuantity('1G')).toBe(1e9);
  });

  it('returns null for something that is not a quantity', () => {
    expect(parseK8sQuantity('mucho')).toBeNull();
    expect(parseK8sQuantity('')).toBeNull();
    expect(parseK8sQuantity(undefined)).toBeNull();
  });
});

describe('assertRequestsWithinLimits', () => {
  const resources = (
    requests: { cpu: string; memory: string },
    limits: { cpu: string; memory: string },
  ) => ({ requests, limits });

  it('accepts a request equal to or below its limit, in different notations', () => {
    expect(() =>
      assertRequestsWithinLimits(
        resources(
          { cpu: '250m', memory: '0.5Gi' },
          { cpu: '1', memory: '512Mi' },
        ),
      ),
    ).not.toThrow();
  });

  it('rejects a CPU request above its limit', () => {
    expect(() =>
      assertRequestsWithinLimits(
        resources(
          { cpu: '2', memory: '256Mi' },
          { cpu: '500m', memory: '1Gi' },
        ),
      ),
    ).toThrow(BadRequestException);
  });

  it('rejects a memory request above its limit', () => {
    expect(() =>
      assertRequestsWithinLimits(
        resources(
          { cpu: '250m', memory: '2Gi' },
          { cpu: '500m', memory: '1Gi' },
        ),
      ),
    ).toThrow(/memory/);
  });
});
