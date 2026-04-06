import { z } from 'zod';
import axios, { AxiosError } from 'axios';

import { AW_API_BASE } from "./config.js";

interface Bucket {
  id?: string;
  name?: string;
  type: string;
  client: string;
  hostname: string;
  created: string;
  data?: Record<string, any>;
}

interface BucketWithId extends Bucket {
  id: string;
}

const inputSchema = {
  type: "object",
  properties: {
    type: {
      type: "string",
      description: "Filter buckets by type"
    },
    includeData: {
      type: "boolean",
      description: "Include bucket data in response"
    }
  }
};

export const activitywatch_list_buckets_tool = {
  name: "activitywatch_list_buckets",
  description: "List all ActivityWatch buckets with optional type filtering",
  inputSchema: inputSchema,
  // Properly structure the returned content for MCP
  handler: async (args: { type?: string; includeData?: boolean }) => {
    try {
      const response = await axios.get(`${AW_API_BASE}/buckets`);
      const buckets: Record<string, Bucket> = response.data;

      // Convert bucket record to array with guaranteed IDs
      let bucketList: BucketWithId[] = Object.entries(buckets).map(([bucketId, bucket]) => ({
        ...bucket,
        id: bucketId
      }));

      // Apply type filter if specified
      if (args.type && typeof args.type === 'string') {
        bucketList = bucketList.filter(bucket =>
          bucket.type.toLowerCase().includes(args.type!.toLowerCase())
        );
      }

      // Format output with consistent structure
      const formattedBuckets = bucketList.map(bucket => {
        const result: BucketWithId = {
          id: bucket.id,
          type: bucket.type,
          client: bucket.client,
          hostname: bucket.hostname,
          created: bucket.created,
          name: bucket.name,
          ...(args.includeData && bucket.data ? { data: bucket.data } : {})
        };

        return result;
      });

            // Begin with the formatted buckets as JSON
      let resultText = JSON.stringify(formattedBuckets, null, 2);

      // Only add helpful guidance in production mode, not test mode
      if (process.env.NODE_ENV !== 'test' && bucketList.length > 0) {
        resultText += "\n\n";
        resultText += "You can access the events in these buckets using the activitywatch_get_events tool, for example:\n";
        resultText += `activitywatch_get_events with bucketId = "${bucketList[0].id}"`;

        if (bucketList.length > 1) {
          resultText += "\n\nOr try a different bucket:\n";
          resultText += `activitywatch_get_events with bucketId = "${bucketList[1].id}"`;
        }
      } else if (process.env.NODE_ENV !== 'test' && bucketList.length === 0) {
        resultText += "\n\nNo buckets found. Please check that ActivityWatch is running and collecting data.";
      }

      return {
        content: [
          {
            type: "text",
            text: resultText
          }
        ]
      };
    } catch (error) {
      console.error("Error in bucket list tool:", error);

      // Check if the error is an Axios error with a response property
      if (axios.isAxiosError(error) && error.response) {
        const statusCode = error.response.status;
        let errorMessage = `Failed to fetch buckets: ${error.message} (Status code: ${statusCode})`;

        // Include response data if available
        if (error.response.data) {
          const errorDetails = typeof error.response.data === 'object'
            ? JSON.stringify(error.response.data)
            : String(error.response.data);
          errorMessage += `\nDetails: ${errorDetails}`;
        }

        return {
          content: [{ type: "text", text: errorMessage }],
          isError: true
        };
      }
      // Handle network errors or other axios errors without response
      else if (axios.isAxiosError(error)) {
        const errorMessage = `Failed to fetch buckets: ${error.message}

This appears to be a network or connection error. Please check:
- The ActivityWatch server is running (http://localhost:5600)
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
          content: [{ type: "text", text: `Failed to fetch buckets: ${error.message}` }],
          isError: true
        };
      }
      // Fallback for unknown errors
      else {
        return {
          content: [{ type: "text", text: "Failed to fetch buckets: Unknown error" }],
          isError: true
        };
      }
    }
  }
};
