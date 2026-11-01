import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Cliente mínimo de la API 2.0 de Bitbucket Cloud con las peticiones que usa
// BitbucketApi. Reemplaza a la librería `bitbucket`, sin mantenimiento desde
// 2024 y que dependía de `deepmerge` (vulnerabilidad sin parche); las rutas,
// parámetros y cuerpos son los mismos que enviaba ella.
export const BITBUCKET_API_URL = 'https://api.bitbucket.org/2.0';

export interface BitbucketResponse<T = any> {
  status: number;
  data: T;
}

// Como en la librería anterior, un error HTTP llega con su `status`.
export class BitbucketRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

export class BitbucketClient {
  private readonly http: AxiosInstance;

  constructor(
    auth?: { username: string; password: string },
    baseURL = BITBUCKET_API_URL,
  ) {
    this.http = axios.create({
      baseURL,
      auth,
      timeout: 15000,
      headers: { accept: 'application/json' },
    });
  }

  private repoPath(workspace: string, repo: string, rest = ''): string {
    return `/repositories/${encodeURIComponent(workspace)}/${encodeURIComponent(repo)}${rest}`;
  }

  private async send<T>(
    request: Promise<AxiosResponse<T>>,
  ): Promise<BitbucketResponse<T>> {
    try {
      const res = await request;
      return { status: res.status, data: res.data };
    } catch (error: any) {
      throw new BitbucketRequestError(
        error?.message ?? 'Bitbucket request failed',
        error?.response?.status ?? 500,
      );
    }
  }

  private post<T = any>(path: string, body: unknown) {
    return this.send<T>(
      this.http.post(path, body, {
        headers: { 'content-type': 'application/json; charset=utf-8' },
      }),
    );
  }

  get<T = any>(path: string) {
    return this.send<T>(this.http.get(path));
  }

  getRepository(workspace: string, repo: string) {
    return this.get(this.repoPath(workspace, repo));
  }

  listWebhooks(workspace: string, repo: string) {
    return this.get(this.repoPath(workspace, repo, '/hooks'));
  }

  createWebhook(workspace: string, repo: string, webhook: object) {
    return this.post(this.repoPath(workspace, repo, '/hooks'), webhook);
  }

  createDeployKey(workspace: string, repo: string, label: string, key: string) {
    return this.post(this.repoPath(workspace, repo, '/deploy-keys'), {
      label,
      key,
    });
  }

  listRepositories(role: string) {
    return this.send(this.http.get('/repositories', { params: { role } }));
  }

  listBranches(workspace: string, repo: string, sort: string) {
    return this.send(
      this.http.get(this.repoPath(workspace, repo, '/refs/branches'), {
        params: { sort },
      }),
    );
  }

  listTags(workspace: string, repo: string, sort: string) {
    return this.send(
      this.http.get(this.repoPath(workspace, repo, '/refs/tags'), {
        params: { sort },
      }),
    );
  }

  listCommits(workspace: string, repo: string, sort: string) {
    return this.send(
      this.http.get(this.repoPath(workspace, repo, '/commits'), {
        params: { sort },
      }),
    );
  }
}
