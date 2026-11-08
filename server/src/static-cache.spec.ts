import { join } from 'path';
import {
  ASSET_CACHE,
  REVALIDATE,
  isApiPath,
  staticCacheControl,
} from './static-cache';

describe('isApiPath', () => {
  it('reconoce la API, con query y sin importar mayúsculas', () => {
    for (const url of [
      '/api',
      '/api/',
      '/api/auth/login',
      '/api/apps?x=1',
      '/API/pipelines',
      '/Api/users/count',
    ]) {
      expect(isApiPath(url)).toBe(true);
    }
  });

  it('deja fuera la web estática', () => {
    for (const url of [
      '/',
      '/overview',
      '/assets/index-lYHbh3PT.js',
      '/apiary',
      '/pipeline/api/apps',
      '/favicon.ico?api',
    ]) {
      expect(isApiPath(url)).toBe(false);
    }
  });
});

const publicDir = join('/app', 'dist', 'public');

describe('staticCacheControl', () => {
  it('guarda un año los archivos con hash de assets/', () => {
    for (const file of [
      'index-lYHbh3PT.js',
      'index-DZrvk03l.css',
      'materialdesignicons-webfont-CYDMK1kx.woff2',
      'Accounts-Dp2h8nyb.js',
    ]) {
      expect(staticCacheControl(join(publicDir, 'assets', file))).toBe(
        ASSET_CACHE,
      );
    }
  });

  it('revalida index.html y lo que no lleva hash', () => {
    for (const file of [
      join(publicDir, 'index.html'),
      join(publicDir, 'favicon.ico'),
      join(publicDir, 'img', 'logo.svg'),
      join(publicDir, 'assets', 'logo.svg'),
    ]) {
      expect(staticCacheControl(file)).toBe(REVALIDATE);
    }
  });
});
