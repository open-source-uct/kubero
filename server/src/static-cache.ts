import { sep } from 'path';
import { filter as compressible } from 'compression';
import type { Request, Response } from 'express';

// Solo se comprime la web estática, nunca la API (ver main.ts: BREACH).
// Se mira la ruta sin la query y en minúsculas, igual que la enruta Express.
export function isApiPath(url: string): boolean {
  const path = url.split('?')[0].toLowerCase();
  return path === '/api' || path.startsWith('/api/');
}

export function shouldCompress(req: Request, res: Response): boolean {
  if (isApiPath(req.originalUrl ?? req.url)) return false;
  return compressible(req, res);
}

// Vite pone un hash del contenido en el nombre de todo lo que genera en
// assets/ (index-lYHbh3PT.js): si el archivo cambia, cambia el nombre. Por
// eso se puede guardar un año sin volver a preguntar al servidor.
const HASHED_ASSET = /[-.][A-Za-z0-9_-]{8,}\.[a-z0-9]+$/;
export const ASSET_CACHE = 'public, max-age=31536000, immutable';
// El resto (index.html, favicon, img/) sí puede cambiar sin cambiar de nombre:
// el navegador lo revalida en cada visita (respuesta 304 si no cambió), así
// siempre toma la versión nueva de la web después de un despliegue.
export const REVALIDATE = 'no-cache';

export function staticCacheControl(filePath: string): string {
  const inAssets = filePath.includes(`${sep}assets${sep}`);
  return inAssets && HASHED_ASSET.test(filePath) ? ASSET_CACHE : REVALIDATE;
}

export function setStaticCacheHeaders(
  res: { setHeader(name: string, value: string): unknown },
  filePath: string,
): void {
  res.setHeader('Cache-Control', staticCacheControl(filePath));
}
