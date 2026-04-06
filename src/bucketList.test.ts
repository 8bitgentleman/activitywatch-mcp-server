import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import axios, { AxiosError } from 'axios';
import { activitywatch_list_buckets_tool } from './bucketList.js';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('activitywatch_list_buckets Tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch and format buckets correctly', async () => {
    const mockBuckets = {
      'aw-watcher-window_hostname': {
        type: 'window',
        client: 'aw-watcher-window',
        hostname: 'hostname',
        created: '2024-02-19T10:00:00.000Z',
        data: { key: 'value' }
      }
    };

    mockedAxios.get.mockResolvedValueOnce({ data: mockBuckets });

    const result = await activitywatch_list_buckets_tool.handler({});

    expect(result.content[0].type).toBe('text');
    const parsedContent = JSON.parse(result.content[0].text);
    expect(parsedContent).toHaveLength(1);
    expect(parsedContent[0].type).toBe('window');
    expect(parsedContent[0].data).toBeUndefined();
    expect(parsedContent[0].id).toBe('aw-watcher-window_hostname');
  });

  it('should filter buckets by type case-insensitively', async () => {
    const mockBuckets = {
      'aw-watcher-window_hostname': {
        type: 'window',
        client: 'aw-watcher-window',
        hostname: 'hostname',
        created: '2024-02-19T10:00:00.000Z'
      },
      'aw-watcher-afk_hostname': {
        type: 'afk',
        client: 'aw-watcher-afk',
        hostname: 'hostname',
        created: '2024-02-19T10:00:00.000Z'
      }
    };

    mockedAxios.get.mockResolvedValueOnce({ data: mockBuckets });

    // Test with uppercase filter
    const result = await activitywatch_list_buckets_tool.handler({ type: 'WINDOW' });
    const parsedContent = JSON.parse(result.content[0].text);
    expect(parsedContent).toHaveLength(1);
    expect(parsedContent[0].type).toBe('window');
  });

  it('should handle invalid type filter gracefully', async () => {
    const mockBuckets = {
      'aw-watcher-window_hostname': {
        type: 'window',
        client: 'aw-watcher-window',
        hostname: 'hostname',
        created: '2024-02-19T10:00:00.000Z'
      }
    };

    mockedAxios.get.mockResolvedValueOnce({ data: mockBuckets });

    const result = await activitywatch_list_buckets_tool.handler({ type: undefined });
    const parsedContent = JSON.parse(result.content[0].text);
    expect(parsedContent).toHaveLength(1); // Should return all buckets
  });

  it('should include data when includeData is true', async () => {
    const mockBuckets = {
      'aw-watcher-window_hostname': {
        type: 'window',
        client: 'aw-watcher-window',
        hostname: 'hostname',
        created: '2024-02-19T10:00:00.000Z',
        data: { key: 'value' }
      }
    };

    mockedAxios.get.mockResolvedValueOnce({ data: mockBuckets });

    const result = await activitywatch_list_buckets_tool.handler({ includeData: true });
    const parsedContent = JSON.parse(result.content[0].text);
    expect(parsedContent[0].data).toBeDefined();
    expect(parsedContent[0].data.key).toBe('value');
  });

  it('should handle API errors with status codes', async () => {
    const mockError = new Error('Request failed with status code 404') as AxiosError;
    mockError.isAxiosError = true;
    mockError.response = {
      status: 404,
      statusText: 'Not Found',
      headers: {},
      config: {} as any,
      data: 'Not Found'
    };

    mockedAxios.get.mockRejectedValueOnce(mockError);

    const result = await activitywatch_list_buckets_tool.handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to fetch buckets');
    expect(result.content[0].text).toContain('404');
  });

  it('should handle non-Axios errors', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('Generic Error'));

    const result = await activitywatch_list_buckets_tool.handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Failed to fetch buckets: Generic Error');
  });

  it('should handle network errors without status code', async () => {
    const mockError = new Error('Network Error') as AxiosError;
    mockError.isAxiosError = true;
    mockError.message = 'Network Error';
    // No response property to simulate network error

    mockedAxios.get.mockRejectedValueOnce(mockError);

    const result = await activitywatch_list_buckets_tool.handler({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Failed to fetch buckets: Network Error');
  });
});
