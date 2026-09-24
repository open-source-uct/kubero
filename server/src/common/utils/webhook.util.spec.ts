import * as crypto from 'crypto';
import {
  safeEqual,
  verifyHmacSha256,
  verifySharedToken,
  webhookSecret,
} from './webhook.util';

const sign = (payload: string, secret: string, prefix = '') =>
  prefix + crypto.createHmac('sha256', secret).update(payload).digest('hex');

describe('webhook.util', () => {
  const original = process.env.KUBERO_WEBHOOK_SECRET;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.KUBERO_WEBHOOK_SECRET;
    } else {
      process.env.KUBERO_WEBHOOK_SECRET = original;
    }
  });

  describe('webhookSecret', () => {
    it('returns undefined when it is not set or empty', () => {
      delete process.env.KUBERO_WEBHOOK_SECRET;
      expect(webhookSecret()).toBeUndefined();
      process.env.KUBERO_WEBHOOK_SECRET = '';
      expect(webhookSecret()).toBeUndefined();
    });

    it('returns the secret when it is set', () => {
      process.env.KUBERO_WEBHOOK_SECRET = 's3cret';
      expect(webhookSecret()).toBe('s3cret');
    });
  });

  describe('safeEqual', () => {
    it('compares equal and different strings, including different lengths', () => {
      expect(safeEqual('abc', 'abc')).toBe(true);
      expect(safeEqual('abc', 'abd')).toBe(false);
      expect(safeEqual('abc', 'abcd')).toBe(false);
      expect(safeEqual('', 'a')).toBe(false);
    });
  });

  describe('verifyHmacSha256', () => {
    const body = '{"ref":"refs/heads/main"}';

    it('accepts a valid signature, with and without prefix', () => {
      expect(verifyHmacSha256(body, sign(body, 'k'), 'k')).toBe(true);
      expect(
        verifyHmacSha256(body, sign(body, 'k', 'sha256='), 'k', 'sha256='),
      ).toBe(true);
    });

    it('accepts a Buffer payload (raw body)', () => {
      expect(
        verifyHmacSha256(
          Buffer.from(body),
          sign(body, 'k', 'sha256='),
          'k',
          'sha256=',
        ),
      ).toBe(true);
    });

    it('rejects a wrong signature, a wrong secret or a tampered body', () => {
      expect(verifyHmacSha256(body, 'nope', 'k')).toBe(false);
      expect(verifyHmacSha256(body, sign(body, 'other'), 'k')).toBe(false);
      expect(verifyHmacSha256(body + ' ', sign(body, 'k'), 'k')).toBe(false);
    });

    it('rejects everything when the secret or the signature is missing', () => {
      expect(verifyHmacSha256(body, sign(body, 'k'), undefined)).toBe(false);
      expect(verifyHmacSha256(body, sign(body, ''), '')).toBe(false);
      expect(verifyHmacSha256(body, undefined, 'k')).toBe(false);
      expect(verifyHmacSha256(body, '', 'k')).toBe(false);
    });
  });

  describe('verifySharedToken', () => {
    it('accepts only the exact secret', () => {
      expect(verifySharedToken('k', 'k')).toBe(true);
      expect(verifySharedToken('x', 'k')).toBe(false);
    });

    it('does not treat undefined === undefined as valid (GitLab bypass)', () => {
      expect(verifySharedToken(undefined, undefined)).toBe(false);
      expect(verifySharedToken('k', undefined)).toBe(false);
      expect(verifySharedToken(undefined, 'k')).toBe(false);
    });
  });
});
