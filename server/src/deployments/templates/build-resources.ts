import { V1Job } from '@kubernetes/client-node';

/** Administrator-only resource overrides; never populated from a build request. */
export function applyBuildResources(job: V1Job): V1Job {
  const pod = job.spec!.template.spec!;
  for (const container of [...pod.containers, ...(pod.initContainers ?? [])]) {
    for (const [resource, setting] of [
      ['cpu', 'CPU'],
      ['memory', 'MEMORY'],
      ['ephemeral-storage', 'STORAGE'],
    ]) {
      for (const [field, suffix] of [
        ['requests', 'REQUEST'],
        ['limits', 'LIMIT'],
      ]) {
        const value = process.env[`KUBERO_BUILD_${setting}_${suffix}`];
        if (value !== undefined) {
          if (
            !/^(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+|[numkKMGTP]i?|Ei?)?$/.test(
              value,
            ) ||
            parseFloat(value) <= 0
          ) {
            throw new Error(
              `Invalid KUBERO_BUILD_${setting}_${suffix} resource quantity`,
            );
          }
          container.resources![field][resource] = value;
        }
      }
    }
  }
  return job;
}
