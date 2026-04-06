import axios, { AxiosError } from 'axios';

import { AW_API_BASE } from "./config.js";

const inputSchema = {
  type: "object",
  properties: {
    bucketId: {
      type: "string",
      description: "ID of the bucket to fetch events from"
    },
    limit: {
      type: "number",
      description: "Maximum number of events to return (default: 100)"
    },
    start: {
      type: "string",
      description: "Start date/time in ISO format (e.g. '2024-02-01T00:00:00Z')"
    },
    end: {
      type: "string",
      description: "End date/time in ISO format (e.g. '2024-02-28T23:59:59Z')"
    }
  },
  required: ["bucketId"]
};

export const activitywatch_get_events_tool = {
  name: "activitywatch_get_events",
  description: "Get raw events from an ActivityWatch bucket",
  inputSchema: inputSchema,
  handler: async (args: { bucketId: string; limit?: number; start?: string; end?: string }) => {
    try {
      // Construct query parameters
      const params: Record<string, string> = {};

      if (args.limit) {
        params.limit = String(args.limit);
      }

      if (args.start) {
        params.start = args.start;
      }

      if (args.end) {
        params.end = args.end;
      }

      // Build query string
      const queryString = Object.entries(params)
        .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
        .join('&');

      const url = `${AW_API_BASE}/buckets/${encodeURIComponent(args.bucketId)}/events${queryString ? `?${queryString}` : ''}`;

      console.error(`Fetching events from: ${url}`);

      // Make the request
      const response = await axios.get(url);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(response.data, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error("Error in raw events tool:", error);

      // Check if the error is an Axios error with a response property
      if (axios.isAxiosError(error) && error.response) {
        const statusCode = error.response.status;
        let errorMessage = `Failed to fetch events: ${error.message} (Status code: ${statusCode})`;

        // Include response data if available
        if (error.response.data) {
          const errorDetails = typeof error.response.data === 'object'
            ? JSON.stringify(error.response.data)
            : String(error.response.data);
          errorMessage += `\nDetails: ${errorDetails}`;
        }

        // Special handling for 404 errors - likely bucket not found
        if (statusCode === 404) {
          errorMessage = `Bucket not found: ${args.bucketId}

Please check that you've entered the correct bucket ID. You can get a list of available buckets using the activitywatch_list_buckets tool.
`;
        }

        return {
          content: [{ type: "text", text: errorMessage }],
          isError: true
        };
      }
      // Handle network errors or other axios errors without response
      else if (axios.isAxiosError(error)) {
        const errorMessage = `Failed to fetch events: ${error.message}

This appears to be a network or connection error. Please check:
- The ActivityWatch server is running
- The API base URL is correct (currently: ${AW_API_BASE})
- No firewall or network issues are blocking the connection
`;
        return {
          content: [{ type: "text", text: errorMessage }],
          isError: true
        };
      }
      // Handle non-axios errors
      else if (error instanceof Error) {
        return {
          content: [{ type: "text", text: `Failed to fetch events: ${error.message}` }],
          isError: true
        };
      }
      // Fallback for unknown errors
      else {
        return {
          content: [{ type: "text", text: "Failed to fetch events: Unknown error" }],
          isError: true
        };
      }
    }
  }
};
