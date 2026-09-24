import * as dns from 'dns';
import { assertSafeUrl, isBlockedAddress, safeLookup } from './ssrf.util';

describe('ssrf.util', () => {
  describe('isBlockedAddress', () => {
    it.each([
      '0.0.0.0',
      '10.1.2.3',
      '100.64.0.1',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.1.1',
      '198.18.0.1',
      '224.0.0.1',
      '::',
      '::1',
      'fd00::1',
      'fe80::1',
      '::ffff:10.0.0.1', // IPv4 mapeada a una privada
      '::ffff:a00:1', // la misma, en hexadecimal (como la normaliza new URL)
      '::ffff:7f00:1', // loopback mapeado
    ])('blocks %s', (address) => {
      expect(isBlockedAddress(address)).toBe(true);
    });

    it.each([
      '8.8.8.8',
      '1.1.1.1',
      '172.15.0.1', // justo fuera de 172.16.0.0/12
      '172.32.0.1',
      '100.63.255.255', // justo fuera del CGNAT
      '2606:4700:4700::1111',
      '::ffff:8.8.8.8',
    ])('allows %s', (address) => {
      expect(isBlockedAddress(address)).toBe(false);
    });
  });

  describe('assertSafeUrl', () => {
    it('accepts public http and https urls', () => {
      expect(assertSafeUrl('https://example.com/t.yaml').hostname).toBe(
        'example.com',
      );
      expect(assertSafeUrl('http://example.com/t.yaml').protocol).toBe('http:');
    });

    it.each([
      'file:///etc/passwd',
      'ftp://example.com/x',
      'gopher://example.com',
      'not a url',
      'http://user:pass@example.com/',
      'http://127.0.0.1/',
      'http://127.1.2.3:8080/',
      'http://169.254.169.254/latest/meta-data/',
      'http://10.0.0.5/',
      'http://192.168.0.10/',
      'http://[::1]/',
      'http://[fd00::1]/',
      'http://localhost/',
      'http://api.localhost/',
      'http://[::ffff:10.0.0.1]/',
    ])('rejects %s', (url) => {
      expect(() => assertSafeUrl(url)).toThrow();
    });
  });

  describe('safeLookup', () => {
    afterEach(() => jest.restoreAllMocks());

    const stubLookup = (addresses: dns.LookupAddress[]) =>
      jest
        .spyOn(dns, 'lookup')
        .mockImplementation(((_h: string, _o: any, cb: any) =>
          cb(null, addresses)) as any);

    it('rejects a host that resolves to an internal address', (done) => {
      stubLookup([{ address: '10.0.0.7', family: 4 }]);
      safeLookup('evil.example', {}, (err) => {
        expect(err).toBeInstanceOf(Error);
        done();
      });
    });

    it('rejects when ANY of the addresses is internal', (done) => {
      stubLookup([
        { address: '8.8.8.8', family: 4 },
        { address: '127.0.0.1', family: 4 },
      ]);
      safeLookup('rebind.example', { all: true }, (err) => {
        expect(err).toBeInstanceOf(Error);
        done();
      });
    });

    it('returns a single address when all is not requested', (done) => {
      stubLookup([{ address: '8.8.8.8', family: 4 }]);
      safeLookup('ok.example', {}, (err, address, family) => {
        expect(err).toBeNull();
        expect(address).toBe('8.8.8.8');
        expect(family).toBe(4);
        done();
      });
    });

    it('returns the list when all is requested', (done) => {
      stubLookup([{ address: '8.8.8.8', family: 4 }]);
      safeLookup('ok.example', { all: true }, (err, list) => {
        expect(err).toBeNull();
        expect(list).toEqual([{ address: '8.8.8.8', family: 4 }]);
        done();
      });
    });
  });
});
