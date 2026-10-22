import { Logger } from '@nestjs/common';
import axios from 'axios';

const logger = new Logger('GithubOrgCheck');

// GITHUB_CLIENT_ORG antes solo marcaba el método de login como "habilitado"
// en la configuración; nunca se comprobaba la membresía real. Fail-closed: si
// la llamada a la API falla por cualquier motivo que no sea un 404 claro (por
// ejemplo, falta el scope "read:org"), se trata como "no es miembro" en vez
// de dejar pasar el login.
export async function isGithubOrgMember(
  accessToken: string,
  org: string,
): Promise<boolean> {
  try {
    const { data } = await axios.get(
      `https://api.github.com/user/memberships/orgs/${encodeURIComponent(org)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return data?.state === 'active';
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return false;
    }
    logger.error(
      `No se pudo verificar la membresía de la organización "${org}" en GitHub ` +
        '(¿falta el scope "read:org" en GITHUB_CLIENT_SCOPE?)',
      error,
    );
    return false;
  }
}
