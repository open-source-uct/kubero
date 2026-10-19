import { createValidationPipe } from './validation';
import { CreateUserDto } from './users/dto/create-user.dto';
import { UpdateUserDto } from './users/dto/update-user.dto';
import { UpdateGroupDto } from './groups/dto/group.dto';
import { CreatePipelineDTO } from './pipelines/dto/replacePipeline.dto';

// Corre el mismo pipe que main.ts sobre los DTOs reales: lo que el cliente
// necesita tiene que sobrevivir al whitelist, y lo demás tiene que caerse.
describe('global ValidationPipe (whitelist)', () => {
  const pipe = createValidationPipe();
  const body = (value: object, metatype: any) =>
    pipe.transform(value, { type: 'body', metatype });

  it('strips nested relations from a team update', async () => {
    const result = await body(
      {
        name: 'Taller1',
        description: 'x',
        users: { connect: { id: 'other-team-user' } },
      },
      UpdateGroupDto,
    );
    expect(result).toEqual({ name: 'Taller1', description: 'x' });
  });

  it('keeps role, teams and isActive when creating a user, but not roleId', async () => {
    const result = await body(
      {
        username: 'ana',
        email: 'ana@uct.cl',
        password: 'password123',
        isActive: true,
        role: 'role-id',
        userGroups: ['team-id'],
        roleId: 'admin-role-id',
      },
      CreateUserDto,
    );
    expect(result).toMatchObject({
      isActive: true,
      role: 'role-id',
      userGroups: ['team-id'],
    });
    expect(result).not.toHaveProperty('roleId');
  });

  it('keeps an unchanged role object when editing a user, but not 2FA fields', async () => {
    const result = await body(
      {
        id: '1',
        firstName: 'Ana',
        role: { id: 'role-id', name: 'profesor' },
        userGroups: [{ id: 'team-id', name: 'Taller1' }],
        twoFaSecret: 'attacker-secret',
        roleId: 'admin-role-id',
      },
      UpdateUserDto,
    );
    expect(result).toEqual({
      firstName: 'Ana',
      role: { id: 'role-id', name: 'profesor' },
      userGroups: [{ id: 'team-id', name: 'Taller1' }],
    });
  });

  it('keeps the deploy keys and webhook of a pipeline', async () => {
    const result = await body(
      {
        pipelineName: 'demo',
        domain: 'demo.local',
        reviewapps: false,
        dockerimage: '',
        deploymentstrategy: 'git',
        buildstrategy: 'dockerfile',
        phases: [
          {
            name: 'production',
            enabled: true,
            context: 'ctx',
            domain: '',
            defaultEnvvars: [],
          },
        ],
        git: {
          provider: 'github',
          keys: { priv: 'priv-key', pub: 'pub-key' },
          webhook: { id: 1 },
          repository: { ssh_url: 'git@github.com:org/repo.git' },
        },
      },
      CreatePipelineDTO,
    );
    expect(result.git).toEqual({
      provider: 'github',
      keys: { priv: 'priv-key', pub: 'pub-key' },
      webhook: { id: 1 },
      repository: { ssh_url: 'git@github.com:org/repo.git' },
    });
  });
});
