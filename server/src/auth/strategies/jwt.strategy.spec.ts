import { JwtStrategy } from './jwt.strategy';

describe('JwtStrategy', () => {
  it('builds the identity through IdentityService (database), not from the token', async () => {
    const identity = {
      resolve: jest.fn().mockResolvedValue({ userId: 'u1' }),
    };
    const strategy = new JwtStrategy(identity as any);
    const payload = { userId: 'u1', permissions: ['user:write'] };
    await expect(strategy.validate(payload)).resolves.toEqual({
      userId: 'u1',
    });
    expect(identity.resolve).toHaveBeenCalledWith(payload);
  });
});
