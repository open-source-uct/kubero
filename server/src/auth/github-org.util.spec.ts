import axios from 'axios';
import { isGithubOrgMember } from './github-org.util';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('isGithubOrgMember', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxios.isAxiosError = jest.requireActual('axios').isAxiosError;
  });

  it('returns true when the membership is active', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { state: 'active' } });
    const result = await isGithubOrgMember('token', 'open-source-uct');
    expect(result).toBe(true);
    expect(mockedAxios.get).toHaveBeenCalledWith(
      'https://api.github.com/user/memberships/orgs/open-source-uct',
      { headers: { Authorization: 'Bearer token' } },
    );
  });

  it('returns false when the membership is only pending', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { state: 'pending' } });
    const result = await isGithubOrgMember('token', 'open-source-uct');
    expect(result).toBe(false);
  });

  it('returns false (not throws) on a 404', async () => {
    mockedAxios.get.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 404 },
    });
    const result = await isGithubOrgMember('token', 'open-source-uct');
    expect(result).toBe(false);
  });

  it('fails closed on an unexpected error (e.g. missing read:org scope)', async () => {
    mockedAxios.get.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 403 },
    });
    const result = await isGithubOrgMember('token', 'open-source-uct');
    expect(result).toBe(false);
  });
});
