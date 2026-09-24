import { TemplatesService } from './templates.service';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TemplatesService', () => {
  let service: TemplatesService;

  beforeEach(() => {
    service = new TemplatesService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should fetch and parse template', async () => {
    const fakeYaml = `
spec:
  name: test-template
  version: 1.0
`;
    mockedAxios.get.mockResolvedValueOnce({ data: fakeYaml });
    const b64url = Buffer.from('http://example.com/template.yaml').toString(
      'base64',
    );
    const result = await service.getTemplate(b64url);
    expect(result).toEqual({ name: 'test-template', version: 1.0 });
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'http://example.com/template.yaml',
      expect.objectContaining({ maxRedirects: 3, timeout: 10000 }),
    );
  });

  it.each([
    'http://127.0.0.1/t.yaml',
    'http://localhost:2000/api/auth/methods',
    'http://169.254.169.254/latest/meta-data/',
    'http://10.0.0.5/t.yaml',
    'file:///etc/passwd',
  ])('should refuse to fetch %s (SSRF)', async (url) => {
    mockedAxios.get.mockClear();
    const b64url = Buffer.from(url).toString('base64');
    await expect(service.getTemplate(b64url)).rejects.toThrow();
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('should throw error if axios fails', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));
    const b64url = Buffer.from('http://fail.com/template.yaml').toString(
      'base64',
    );
    await expect(service.getTemplate(b64url)).rejects.toThrow('Network error');
  });
});
