import axios from 'axios';

import { AW_API_BASE } from "./config.js";

export interface SettingsResponse {
  [key: string]: any;
}

const inputSchema = {
  type: "object",
  properties: {
    key: {
      type: "string",
      description: "Optional: Get a specific settings key instead of all settings"
    }
  }
};

export const activitywatch_get_settings_tool = {
  name: "activitywatch_get_settings",
  description: "Get ActivityWatch settings. Can retrieve all settings or a specific key if provided.",
  inputSchema: inputSchema,

  handler: async (args: { key?: string }) => {
    try {
      let endpoint = `${AW_API_BASE}/settings`;

      // If a specific key is requested, append it to the endpoint
      if (args.key && typeof args.key === 'string') {
        endpoint = `${endpoint}/${encodeURIComponent(args.key)}`;
      }

      const response = await axios.get(endpoint);
      const settings: SettingsResponse = response.data;

      // Format the settings data nicely
      const formattedSettings = JSON.stringify(settings, null, 2);

      let resultText = formattedSettings;

      // Add helpful guidance if we're not in test mode
      if (process.env.NODE_ENV !== 'test') {
        if (args.key) {
          resultText += `\n\nShowing settings for key: "${args.key}"\n`;
          resultText += `To get all settings, use activitywatch_get_settings without a key parameter.`;
        } else {
          resultText += `\n\nShowing all ActivityWatch settings.\n`;
          resultText += `To get a specific setting, use activitywatch_get_settings with a key parameter.`;

          // Add example of a specific key if there are any settings
          if (Object.keys(settings).length > 0) {
            const exampleKey = Object.keys(settings)[0];
            resultText += `\nFor example: activitywatch_get_settings with key = "${exampleKey}"`;
          }
        }
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
      console.error("Error in get settings tool:", error);

      // Handle Axios errors with response
      if (axios.isAxiosError(error)) {
        if (error.response) {
          // Error with response (e.g. 404, 500, etc)
          const statusCode = error.response.status;
          let errorMessage = `Failed to fetch settings: ${error.message} (Status code: ${statusCode})`;

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
        } else {
          // Network error (no response)
          const errorMessage = `Failed to fetch settings: ${error.message}

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
      }
      // Handle non-axios errors
      else if (error instanceof Error) {
        return {
          content: [{ type: "text", text: `Failed to fetch settings: ${error.message}` }],
          isError: true
        };
      }
      // Fallback for unknown errors
      else {
        return {
          content: [{ type: "text", text: `Failed to fetch settings: Unknown error` }],
          isError: true
        };
      }
    }
  }
};
