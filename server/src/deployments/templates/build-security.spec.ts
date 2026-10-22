import * as YAML from 'yaml';
import { existsSync } from 'fs';
import { spawnSync } from 'child_process';
import { dockerfileTemplate } from './dockerfile.yaml';
import { nixpacksTemplate } from './nixpacks.yaml';
import { buildpacksTemplate } from './buildpacks.yaml';
import { applyBuildResources } from './build-resources';
import { KubernetesService } from '../../kubernetes/kubernetes.service';

const templates = {
  dockerfile: dockerfileTemplate,
  nixpacks: nixpacksTemplate,
  buildpacks: buildpacksTemplate,
};
const shell =
  process.platform === 'win32'
    ? 'C:/Program Files/Git/bin/bash.exe'
    : '/bin/sh';
const shellTest = existsSync(shell) ? it : it.skip;

describe.each(Object.entries(templates))(
  '%s build hardening',
  (strategy, template) => {
    const parse = () => YAML.parse(template);

    it('sets bounded resources, deadline, and nonprivileged containers', () => {
      const job = parse();
      expect(job.spec.activeDeadlineSeconds).toBe(1800);
      const pod = job.spec.template.spec;
      expect(pod.securityContext.seccompProfile.type).toBe('RuntimeDefault');
      expect(pod.hostUsers).toBe(false);
      for (const c of [...pod.containers, ...pod.initContainers]) {
        expect(c.securityContext.privileged).toBe(false);
        expect(c.securityContext.allowPrivilegeEscalation).toBe(false);
        expect(c.securityContext.capabilities.drop).toContain('ALL');
        if (c.securityContext.capabilities.add?.includes('SYS_ADMIN')) {
          expect(c.name).toBe('push');
          expect(pod.hostUsers).toBe(false);
        }
        for (const field of ['requests', 'limits']) {
          for (const resource of ['cpu', 'memory', 'ephemeral-storage'])
            expect(c.resources[field][resource]).toBeTruthy();
        }
      }
    });

    it('mounts a projected API credential exclusively in deploy', () => {
      const pod = parse().spec.template.spec;
      expect(pod.automountServiceAccountToken).toBe(false);
      const tokenVolume = pod.volumes.find((v) =>
        v.projected?.sources.some((s) => s.serviceAccountToken),
      );
      expect(
        tokenVolume.projected.sources[0].serviceAccountToken.expirationSeconds,
      ).toBe(3600);
      expect(pod.containers[0].volumeMounts).toContainEqual(
        expect.objectContaining({ name: tokenVolume.name, readOnly: true }),
      );
      for (const c of pod.initContainers)
        expect(c.volumeMounts.map((v) => v.name)).not.toContain(
          tokenVolume.name,
        );
      expect(pod.containers[0].volumeMounts.map((v) => v.name)).not.toContain(
        'app-storage',
      );
      expect(
        pod.volumes.find((v) => v.name === 'app-storage').emptyDir.sizeLimit,
      ).toBe('4Gi');
    });

    it('generates actual jobs retaining hardening and the selected cluster', async () => {
      const init = jest
        .spyOn(KubernetesService.prototype as any, 'initKubeConfig')
        .mockResolvedValue(undefined);
      try {
        const service = new KubernetesService();
        const createNamespacedJob = jest.fn().mockResolvedValue({});
        jest.spyOn(service as any, 'clientsForContext').mockReturnValue({
          batchV1Api: { createNamespacedJob },
          coreV1Api: {
            createNamespacedPod: jest.fn(async (_ns, pod, _pretty, dryRun) => {
              expect(dryRun).toBe('All');
              return { body: pod };
            }),
          },
        });
        await service.createBuildJob(
          'team-dev',
          'web',
          'team',
          strategy as any,
          'Dockerfile',
          { url: 'ssh://example.invalid/repo', ref: 'main' },
          { image: 'registry.invalid/team-web', tag: 'main' },
          'cluster-a',
        );
        expect((service as any).clientsForContext).toHaveBeenCalledWith(
          'cluster-a',
        );
        const job = createNamespacedJob.mock.calls[0][1];
        expect(job.spec.template.spec.automountServiceAccountToken).toBe(false);
        expect(job.spec.template.spec.serviceAccountName).toBe('web-kuberoapp');
        const env = job.spec.template.spec.containers[0].env;
        expect(env.find((e) => e.name === 'APP').value).toBe('web');
        expect(env.find((e) => e.name === 'REPOSITORY').value).toBe(
          'registry.invalid/team-web',
        );
      } finally {
        init.mockRestore();
      }
    });

    it('does not create a Job if admission strips user namespace isolation', async () => {
      const init = jest
        .spyOn(KubernetesService.prototype as any, 'initKubeConfig')
        .mockResolvedValue(undefined);
      try {
        const service = new KubernetesService();
        const createNamespacedJob = jest.fn();
        const createNamespacedPod = jest
          .fn()
          .mockResolvedValue({ body: { spec: {} } });
        jest.spyOn(service as any, 'clientsForContext').mockReturnValue({
          batchV1Api: { createNamespacedJob },
          coreV1Api: { createNamespacedPod },
        });
        await expect(
          service.createBuildJob(
            'ns',
            'web',
            'team',
            strategy as any,
            'Dockerfile',
            { url: 'ssh://example.invalid/repo', ref: 'main' },
            { image: 'registry.invalid/web', tag: 'main' },
            'cluster-a',
          ),
        ).rejects.toThrow(
          'Builds require Kubernetes pod user namespace support',
        );
        expect(createNamespacedJob).not.toHaveBeenCalled();
      } finally {
        init.mockRestore();
      }
    });

    it('keeps TLS verification on and quotes build arguments', () => {
      const push = parse().spec.template.spec.initContainers.find(
        (c) => c.name === 'push',
      );
      if (!push) return; // CNB creator exports directly and uses verified TLS by default.
      const command = push.command[2];
      expect(command).not.toContain('--tls-verify=false');
      expect(command.match(/--tls-verify=true/g)).toHaveLength(2);
      expect(command).toContain('"$BUILDAH_DOCKERFILE_PATH"');
      expect(command).toContain('"$BUILD_IMAGE"');
      expect(command).toContain('set -eu');
    });

    shellTest(
      'executes the deploy script with intact arguments and valid JSON',
      () => {
        const script = parse().spec.template.spec.containers[0].command[2];
        const result = spawnSync(
          shell,
          ['-c', 'kubectl() { printf "%s\\n" "$@"; };\n' + script],
          {
            encoding: 'utf8',
            env: {
              ...process.env,
              APP: 'web',
              REPOSITORY: 'registry.invalid:5000/team/web',
              TAG: 'main-123',
            },
          },
        );
        expect(result.status).toBe(0);
        const args = result.stdout.trim().split(/\r?\n/);
        expect(args.slice(0, 5)).toEqual([
          'patch',
          'kuberoapps',
          'web',
          '--type=merge',
          '-p',
        ]);
        expect(JSON.parse(args[5])).toEqual({
          spec: {
            image: {
              repository: 'registry.invalid:5000/team/web',
              tag: 'main-123',
            },
          },
        });
      },
    );

    shellTest.each(['APP', 'REPOSITORY', 'TAG'])(
      'rejects unsafe %s without calling kubectl',
      (field) => {
        const script = parse().spec.template.spec.containers[0].command[2];
        const result = spawnSync(
          shell,
          ['-c', 'kubectl() { printf CALLED; };\n' + script],
          {
            encoding: 'utf8',
            env: {
              ...process.env,
              APP: 'web',
              REPOSITORY: 'registry.invalid/web',
              TAG: 'main',
              [field]: 'invalid"; echo unexpected',
            },
          },
        );
        expect(result.status).not.toBe(0);
        expect(result.stdout).toBe('');
      },
    );
  },
);

describe('administrator resource configuration', () => {
  const original = process.env.KUBERO_BUILD_MEMORY_LIMIT;
  afterEach(() => {
    if (original === undefined) delete process.env.KUBERO_BUILD_MEMORY_LIMIT;
    else process.env.KUBERO_BUILD_MEMORY_LIMIT = original;
  });
  it('applies resource overrides to every container', () => {
    process.env.KUBERO_BUILD_MEMORY_LIMIT = '3Gi';
    const pod = applyBuildResources(YAML.parse(nixpacksTemplate)).spec!.template
      .spec!;
    for (const c of [...pod.containers, ...pod.initContainers!])
      expect(c.resources!.limits!.memory).toBe('3Gi');
  });
  it.each(['', '0', '-1', 'invalid'])(
    'rejects invalid resource quantity %s',
    (value) => {
      process.env.KUBERO_BUILD_MEMORY_LIMIT = value;
      expect(() => applyBuildResources(YAML.parse(dockerfileTemplate))).toThrow(
        'Invalid KUBERO_BUILD_MEMORY_LIMIT',
      );
    },
  );
});
