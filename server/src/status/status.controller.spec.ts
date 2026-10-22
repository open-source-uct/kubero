import { PrometheusController } from '@willsoto/nestjs-prometheus';
import { StatusController } from './status.controller';

describe('StatusController', () => {
  it('delegates an authorized request to Prometheus, including proxied requests', async () => {
    const spy = jest
      .spyOn(PrometheusController.prototype, 'index')
      .mockResolvedValue('metrics data');
    try {
      const response = {
        req: { headers: { 'x-forwarded-for': '203.0.113.1' } },
      } as any;
      expect(await new StatusController().index(response)).toBe('metrics data');
      expect(spy).toHaveBeenCalledWith(response);
    } finally {
      spy.mockRestore();
    }
  });
});
