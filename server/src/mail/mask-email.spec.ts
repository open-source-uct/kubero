import { maskEmail } from './mail.service';

describe('maskEmail', () => {
  it('hides most of the local part and keeps the domain', () => {
    expect(maskEmail('ana.lopez@uct.cl')).toBe('an***@uct.cl');
    expect(maskEmail('a@uct.cl')).toBe('a***@uct.cl');
  });

  it('does not reveal anything that is not an address', () => {
    expect(maskEmail('sin-arroba')).toBe('***');
    expect(maskEmail(undefined as any)).toBe('***');
  });
});
