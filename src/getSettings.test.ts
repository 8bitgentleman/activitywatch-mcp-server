import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import axios from 'axios';
import { activitywatch_get_settings_tool, SettingsResponse } from './getSettings.js';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('activitywatch_get_settings_tool', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Set the NODE_ENV to test to avoid extra guidance text
    process.env.NODE_ENV = 'test';
  });

  test('returns all settings when no key provided', async () => {
    // Mock the response
    const mockSettings: SettingsResponse = {
      setting1: 'value1',
      setting2: 'value2',
      nested: {
        key: 'value'
      }
    };
    mockedAxios.get.mockResolvedValueOnce({ data: mockSettings });

    // Call the handler
    const result = await activitywatch_get_settings_tool.handler({});

    // Expectations
    expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:5600/api/0/settings');
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: JSON.stringify(mockSettings, null, 2)
        }
      ]
    });
  });

  test('returns specific setting when key is provided', async () => {
    // Mock the response
    const mockSetting = 'specific-value';
    mockedAxios.get.mockResolvedValueOnce({ data: mockSetting });

    // Call the handler
    const result = await activitywatch_get_settings_tool.handler({ key: 'setting1' });

    // Expectations
    expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:5600/api/0/settings/setting1');
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: JSON.stringify(mockSetting, null, 2)
        }
      ]
    });
  });

  test('properly encodes URI components in key parameter', async () => {
    // Mock the response
    const mockSetting = { value: 'test' };
    mockedAxios.get.mockResolvedValueOnce({ data: mockSetting });

    // Call the handler with a key that needs encoding
    const result = await activitywatch_get_settings_tool.handler({ key: 'complex/key with spaces' });

    // Expectations - check that the URL was properly encoded
    expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:5600/api/0/settings/complex%2Fkey%20with%20spaces');
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: JSON.stringify(mockSetting, null, 2)
        }
      ]
    });
  });

  test('handles API error correctly', async () => {
    // Create an error object that more closely resembles a real Axios error
    const error = new Error('Request failed with status code 404') as any;
    error.isAxiosError = true;
    error.message = 'Request failed with status code 404';
    error.response = {
      status: 404,
      data: { error: 'Setting not found' }
    };

    // Mock the error
    mockedAxios.get.mockRejectedValueOnce(error);

    // Make sure isAxiosError returns true for this error
    mockedAxios.isAxiosError.mockImplementation((val): val is any => true);

    // Call the handler
    const result = await activitywatch_get_settings_tool.handler({ key: 'nonexistent' });

    // Expectations
    expect(result).toHaveProperty('isError', true);
    expect(result.content[0].text).toContain('Failed to fetch settings');
    expect(result.content[0].text).toContain('Status code: 404');
    expect(result.content[0].text).toContain('Setting not found');
  });

  test('handles network error correctly', async () => {
    // Create an error object that more closely resembles a real Axios error
    const error = new Error('Network Error') as any;
    error.isAxiosError = true;
    error.message = 'Network Error';

    // Mock the error
    mockedAxios.get.mockRejectedValueOnce(error);

    // Make sure isAxiosError returns true
    mockedAxios.isAxiosError.mockImplementation((val): val is any => true);

    // Call the handler
    const result = await activitywatch_get_settings_tool.handler({});

    // Expectations
    expect(result).toHaveProperty('isError', true);
    expect(result.content[0].text).toContain('Failed to fetch settings: Network Error');
    expect(result.content[0].text).toContain('This appears to be a network or connection error');
  });

  test('handles validation with undefined key parameter', async () => {
    // Mock the response
    const mockSettings: SettingsResponse = {
      setting1: 'value1',
      setting2: 'value2'
    };
    mockedAxios.get.mockResolvedValueOnce({ data: mockSettings });

    // Call the handler with undefined key
    const result = await activitywatch_get_settings_tool.handler({ key: undefined });

    // Expectations - should call the endpoint for all settings
    expect(mockedAxios.get).toHaveBeenCalledWith('http://localhost:5600/api/0/settings');
    expect(result).toEqual({
      content: [
        {
          type: 'text',
          text: JSON.stringify(mockSettings, null, 2)
        }
      ]
    });
  });

  test('adds helpful guidance when not in test mode', async () => {
    // Temporarily set NODE_ENV to something other than test
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    // Mock the response
    const mockSettings: SettingsResponse = {
      setting1: 'value1',
      setting2: 'value2'
    };
    mockedAxios.get.mockResolvedValueOnce({ data: mockSettings });

    // Call the handler
    const result = await activitywatch_get_settings_tool.handler({});

    // Expectations - verify that guidance text is included
    expect(result.content[0].text).toContain(JSON.stringify(mockSettings, null, 2));
    expect(result.content[0].text).toContain('Showing all ActivityWatch settings');
    expect(result.content[0].text).toContain('To get a specific setting');

    // Restore the original NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });
});
