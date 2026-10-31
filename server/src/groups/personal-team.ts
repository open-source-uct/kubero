import { PrismaClient } from '@prisma/client';

// Cada usuario (salvo los roles supervisados, ver abajo) tiene un equipo
// personal que solo integra él. Es el equipo que
// el formulario de pipelines marca por defecto: lo que alguien crea lo ve solo
// él (y admin) hasta que lo comparte con otro equipo, aunque comparta equipos
// con otras personas.
export const PERSONAL_TEAM_PREFIX = 'personal-';

// Roles que trabajan bajo un profesor: todo lo que crean tiene que quedar en
// un equipo de su curso, a la vista del profesor. No tienen equipo personal,
// sus pipelines no pueden quedar solo en equipos personales y no crean equipos.
export const SUPERVISED_ROLES = ['estudiante', 'ayudante'];

export function isSupervisedRole(roleName?: string | null): boolean {
  return !!roleName && SUPERVISED_ROLES.includes(roleName);
}

export function hasPersonalTeam(roleName?: string | null): boolean {
  return !!roleName && !isSupervisedRole(roleName);
}

export function isReservedTeamName(name: string): boolean {
  return name.toLowerCase().startsWith(PERSONAL_TEAM_PREFIX);
}

export async function ensurePersonalTeam(
  prisma: PrismaClient,
  user: { id: string; username: string },
) {
  const existing = await prisma.userGroup.findUnique({
    where: { ownerId: user.id },
  });
  if (existing) {
    return existing;
  }
  // Un nombre ya usado no se reutiliza: el equipo de una cuenta borrada se
  // conserva, y sus pipelines siguen apuntando a ese nombre; un usuario nuevo
  // con el mismo username los vería.
  const base = `${PERSONAL_TEAM_PREFIX}${user.username}`;
  let name = base;
  for (let n = 2; await prisma.userGroup.findUnique({ where: { name } }); n++) {
    name = `${base}-${n}`;
  }
  return prisma.userGroup.create({
    data: {
      name,
      description: `Equipo personal de ${user.username}`,
      ownerId: user.id,
      users: { connect: { id: user.id } },
    },
  });
}
