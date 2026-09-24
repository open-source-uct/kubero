import * as dns from 'dns';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';

/**
 * Protección contra SSRF para las URLs que llegan desde el usuario (por ejemplo
 * el catálogo de templates). Bloquea direcciones internas: loopback, redes
 * privadas, link-local (incluye el endpoint de metadatos de la nube), CGNAT y
 * equivalentes IPv6.
 *
 * Se valida en tres puntos, porque cualquiera de ellos por separado se puede
 * evitar: la IP literal de la URL (el DNS no se consulta para una IP literal),
 * la resolución DNS (un dominio público que apunta a una IP interna) y cada
 * redirección.
 */

function ipv4ToInt(ip: string): number {
  return (
    ip
      .split('.')
      .reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
  );
}

const BLOCKED_V4: Array<[string, number]> = [
  ['0.0.0.0', 8], // "esta red"
  ['10.0.0.0', 8], // privada
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local / metadatos cloud
  ['172.16.0.0', 12], // privada
  ['192.0.0.0', 24], // IETF
  ['192.168.0.0', 16], // privada
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reservada
];

export function isBlockedAddress(address: string): boolean {
  const version = net.isIP(address);
  if (version === 4) {
    const value = ipv4ToInt(address);
    return BLOCKED_V4.some(([base, bits]) => {
      const mask = (~0 << (32 - bits)) >>> 0;
      return (value & mask) >>> 0 === (ipv4ToInt(base) & mask) >>> 0;
    });
  }
  if (version === 6) {
    const ip = address.toLowerCase();
    // IPv4 mapeada: se valida como IPv4. Puede venir en notación con puntos
    // (::ffff:10.0.0.1) o, tal como la normaliza new URL(), en hexadecimal
    // (::ffff:a00:1).
    const dotted = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (dotted) {
      return isBlockedAddress(dotted[1]);
    }
    const hex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
    if (hex) {
      const high = parseInt(hex[1], 16);
      const low = parseInt(hex[2], 16);
      return isBlockedAddress(
        `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`,
      );
    }
    return (
      ip === '::' ||
      ip === '::1' ||
      ip.startsWith('fc') || // fc00::/7 (ULA)
      ip.startsWith('fd') ||
      ip.startsWith('fe8') || // fe80::/10 (link-local)
      ip.startsWith('fe9') ||
      ip.startsWith('fea') ||
      ip.startsWith('feb') ||
      ip.startsWith('ff') // multicast
    );
  }
  // ni IPv4 ni IPv6: no debería llegar aquí, se rechaza por seguridad
  return true;
}

// Solo http(s) y, si el host es una IP, que no sea interna.
export function assertSafeUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed');
  }
  if (url.username || url.password) {
    throw new Error('URLs with credentials are not allowed');
  }
  // los corchetes de las IPv6 literales no forman parte de la dirección
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host) && isBlockedAddress(host)) {
    throw new Error('The URL points to a blocked address');
  }
  if (host.toLowerCase() === 'localhost' || host.endsWith('.localhost')) {
    throw new Error('The URL points to a blocked address');
  }
  return url;
}

// `lookup` para los agentes http(s): resuelve el nombre y rechaza si ALGUNA de
// las direcciones es interna (evita el DNS que devuelve una pública y una privada).
export function safeLookup(
  hostname: string,
  options: any,
  callback: (err: any, address?: any, family?: number) => void,
): void {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) {
      return callback(err);
    }
    const list = addresses as unknown as dns.LookupAddress[];
    const blocked = list.find((a) => isBlockedAddress(a.address));
    if (blocked) {
      return callback(
        new Error(`The host resolves to a blocked address (${hostname})`),
      );
    }
    if (options && options.all) {
      return callback(null, list);
    }
    return callback(null, list[0].address, list[0].family);
  });
}

export const safeHttpAgent = new http.Agent({ lookup: safeLookup as any });
export const safeHttpsAgent = new https.Agent({ lookup: safeLookup as any });

// Opciones de axios para pedir una URL que viene del usuario.
export function safeAxiosOptions() {
  return {
    httpAgent: safeHttpAgent,
    httpsAgent: safeHttpsAgent,
    maxRedirects: 3,
    // cada redirección se vuelve a validar (el DNS ya lo cubre el agente)
    beforeRedirect: (options: any) => {
      assertSafeUrl(`${options.protocol}//${options.hostname}${options.path}`);
    },
    timeout: 10000,
    maxContentLength: 1024 * 1024,
    maxBodyLength: 1024 * 1024,
    // se devuelve el texto tal cual; sin esto axios parsea JSON y el YAML.parse
    // posterior falla con "source is not a string"
    responseType: 'text' as const,
    transformResponse: (data: any) => data,
  };
}
