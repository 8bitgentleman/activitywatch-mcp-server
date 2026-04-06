import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { activitywatch_list_buckets_tool } from "./bucketList.js";
import { activitywatch_run_query_tool } from "./query.js";
import { activitywatch_get_events_tool } from "./rawEvents.js";
import { activitywatch_query_examples_tool } from "./queryExamples.js";
import { activitywatch_get_settings_tool } from "./getSettings.js";
import { AW_API_BASE } from "./config.js";

// Populate the VERSION constant from package.json
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const packageJson = require('../package.json');
const VERSION = packageJson.version;

// Helper function to handle type-safe tool responses
const makeSafeToolResponse = (handler: Function) => async (...args: any[]) => {
  try {
    const result = await handler(...args);
    if (!result) {
      return {
        content: [{ type: "text", text: "Error: Tool handler returned no result" }],
        isError: true
      };
    }
    return result;
  } catch (error) {
    console.error("Tool execution error:", error);
    return {
      content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true
    };
  }
};

// Create server instance
const server = new Server({
  name: "activitywatch-server",
  version: VERSION
}, {
  capabilities: {
    tools: {}
  }
});

// Register tools list handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: activitywatch_list_buckets_tool.name,
        description: activitywatch_list_buckets_tool.description,
        inputSchema: activitywatch_list_buckets_tool.inputSchema
      },
      {
        name: activitywatch_query_examples_tool.name,
        description: activitywatch_query_examples_tool.description,
        inputSchema: activitywatch_query_examples_tool.inputSchema
      },
      {
        name: activitywatch_run_query_tool.name,
        description: activitywatch_run_query_tool.description,
        inputSchema: activitywatch_run_query_tool.inputSchema
      },
      {
        name: activitywatch_get_events_tool.name,
        description: activitywatch_get_events_tool.description,
        inputSchema: activitywatch_get_events_tool.inputSchema
      },
      {
        name: activitywatch_get_settings_tool.name,
        description: activitywatch_get_settings_tool.description,
        inputSchema: activitywatch_get_settings_tool.inputSchema
      }
    ]
  };
});

// Register tool call handler
server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  // Default empty object if arguments is undefined
  let args = request.params.arguments || {};

  if (request.params.name === activitywatch_list_buckets_tool.name) {
    // Cast to the expected type for the bucket list tool
    return makeSafeToolResponse(activitywatch_list_buckets_tool.handler)({
      type: typeof args.type === 'string' ? args.type : undefined,
      includeData: Boolean(args.includeData)
    });
  } else if (request.params.name === activitywatch_query_examples_tool.name) {
    return makeSafeToolResponse(activitywatch_query_examples_tool.handler)();
  } else if (request.params.name === activitywatch_run_query_tool.name) {
    // For the query tool, we need to validate and normalize the args

    // First, log the raw arguments to debug format issues
    console.error(`\nRAW ARGS FROM MCP CLIENT:`);
    console.error(JSON.stringify(request.params.arguments, null, 2));
    console.error(`\nTYPE: ${typeof request.params.arguments}`);
    console.error(`\nARRAY? ${Array.isArray(request.params.arguments)}`);

    // Make a mutable copy of the arguments
    let queryArgs = {...(request.params.arguments || {})};

    // Try to see if this is JSON string that needs parsing
    if (typeof request.params.arguments === 'string') {
      try {
        const parsedArgs = JSON.parse(request.params.arguments);
        console.error(`Parsed string arguments into object:`);
        console.error(JSON.stringify(parsedArgs, null, 2));
        queryArgs = parsedArgs;
      } catch (e) {
        console.error(`Failed to parse arguments string: ${e}`);
      }
    }

    // More diagnostic info
    if (queryArgs.query) {
      console.error(`Query type: ${typeof queryArgs.query}`);
      console.error(`Query array? ${Array.isArray(queryArgs.query)}`);
      console.error(`Query value: ${JSON.stringify(queryArgs.query, null, 2)}`);

      if (Array.isArray(queryArgs.query) && queryArgs.query.length > 0) {
        console.error(`First item type: ${typeof queryArgs.query[0]}`);
        console.error(`First item array? ${Array.isArray(queryArgs.query[0])}`);
      }
    }

    // Validate timeperiods
    if (!queryArgs.timeperiods) {
      return makeSafeToolResponse(() => ({
        content: [{
          type: "text",
          text: "Error: Missing required parameter 'timeperiods' (must be an array of date ranges)"
        }],
        isError: true
      }))();
    }

    if (!Array.isArray(queryArgs.timeperiods)) {
      // Try to normalize a single string to an array
      if (typeof queryArgs.timeperiods === 'string') {
        queryArgs.timeperiods = [queryArgs.timeperiods];
        console.error(`Normalized timeperiods from string to array: ${JSON.stringify(queryArgs.timeperiods)}`);
      } else {
        return makeSafeToolResponse(() => ({
          content: [{
            type: "text",
            text: "Error: 'timeperiods' must be an array of date ranges in format: ['2024-10-28/2024-10-29']"
          }],
          isError: true
        }))();
      }
    }

    // Validate query
    if (!queryArgs.query) {
      return makeSafeToolResponse(() => ({
        content: [{
          type: "text",
          text: "Error: Missing required parameter 'query'"
        }],
        isError: true
      }))();
    }

    // Handle different query formats
    if (!Array.isArray(queryArgs.query)) {
      // If it's a string, wrap it in an array
      if (typeof queryArgs.query === 'string') {
        queryArgs.query = [queryArgs.query];
        console.error(`Normalized query from string to array: ${JSON.stringify(queryArgs.query)}`);
      } else {
        return makeSafeToolResponse(() => formatValidationError())();
      }
    }

    // Check for double-wrapped array format (an issue with some MCP clients)
    if (Array.isArray(queryArgs.query) && queryArgs.query.length === 1 && Array.isArray(queryArgs.query[0])) {
      // Extract the inner array
      const innerArray = queryArgs.query[0];
      console.error(`Detected double-wrapped query array from MCP client. Unwrapping...`);
      console.error(`Original: ${JSON.stringify(queryArgs.query)}`);

      if (Array.isArray(innerArray) && innerArray.length >= 1) {
        // If the inner array is itself an array, take its first element
        if (Array.isArray(innerArray[0])) {
          console.error(`Triple-nested array detected! Unwrapping multiple levels...`);
          queryArgs.query = innerArray[0] as unknown as string[];
        } else {
          queryArgs.query = innerArray as unknown as string[];
        }
        console.error(`Unwrapped: ${JSON.stringify(queryArgs.query)}`);
      }
    }

    // Special case: Check if we received an array of query lines that need to be combined
    if (Array.isArray(queryArgs.query) && queryArgs.query.length > 1) {
      // Check if they look like separate query statements
      const areQueryStatements = queryArgs.query.some(q =>
        typeof q === 'string' && (q.includes('=') || q.trim().endsWith(';'))
      );

      if (areQueryStatements) {
        // Join them into a single query string
        const combinedQuery = queryArgs.query.join(' ');
        queryArgs.query = [combinedQuery];
        console.error(`Combined multiple query statements into a single string: ${combinedQuery}`);
      }
    }

    // Log the processed query
    console.error(`Processed query for execution: ${JSON.stringify({timeperiods: queryArgs.timeperiods, query: queryArgs.query})}`);

    return makeSafeToolResponse(activitywatch_run_query_tool.handler)({
      timeperiods: queryArgs.timeperiods as string[],
      query: queryArgs.query as string[],
      name: typeof queryArgs.name === 'string' ? queryArgs.name : undefined
    });

    // Helper function to return a nicely formatted validation error
    function formatValidationError() {
      return {
        content: [{
          type: "text",
          text: `Error: Invalid query format.

The correct format for the 'run-query' tool is:

{
  "timeperiods": ["2024-10-28/2024-10-29"],
  "query": ["events = query_bucket('bucket-id'); another_statement; RETURN = result;"]
}

NOTE THE FORMAT:
1. 'timeperiods' is an array with date ranges formatted as start/end with a slash
2. 'query' is an array with a SINGLE STRING containing all statements
3. All query statements must be in the same string, separated by semicolons

COMMON ERRORS:
- Splitting query statements into separate array items (WRONG)
- Not using semicolons between statements
- Not wrapping query in an array
- Double-wrapping the query in nested arrays (some MCP clients may do this)

DEBUGGING TIP:
If you're working with an MCP client that consistently produces errors, try examining the exact format
of the query parameter it sends. The server tries to automatically detect and handle various formats,
but may need additional configuration.
`
        }],
        isError: true
      };
    }
  } else if (request.params.name === activitywatch_get_events_tool.name) {
    // For the raw events tool
    if (!args.bucketId || typeof args.bucketId !== 'string') {
      return makeSafeToolResponse(() => ({
        content: [{
          type: "text",
          text: "Error: Missing required parameter 'bucketId' (must be a string)"
        }],
        isError: true
      }))();
    }

    return makeSafeToolResponse(activitywatch_get_events_tool.handler)({
      bucketId: args.bucketId,
      limit: typeof args.limit === 'number' ? args.limit : undefined,
      start: typeof args.start === 'string' ? args.start : undefined,
      end: typeof args.end === 'string' ? args.end : undefined
    });
  } else if (request.params.name === activitywatch_get_settings_tool.name) {
    // For the settings tool
    return makeSafeToolResponse(activitywatch_get_settings_tool.handler)({
      key: typeof args.key === 'string' ? args.key : undefined
    });
  }

  // Always return a properly formatted and type-safe response
  return makeSafeToolResponse(() => ({
    content: [{
      type: "text",
      text: `Error: Tool not found: ${request.params.name}`
    }],
    isError: true
  }))();
});

async function main() {
  // Output application banner
  console.error("ActivityWatch MCP Server");
  console.error("=======================");
  console.error(`Version: ${VERSION}`);
  console.error(`API Endpoint: ${AW_API_BASE}`);
  console.error("Tools: activitywatch_list_buckets, activitywatch_query_examples, activitywatch_run_query, activitywatch_get_events, activitywatch_get_settings");
  console.error("=======================");
  console.error("For help with query format, use the 'activitywatch_query_examples' tool first");
  console.error("'activitywatch_run_query' Example format:");
  console.error(`{
  "timeperiods": ["2024-10-28/2024-10-29"],
  "query": ["events = query_bucket('aw-watcher-window_UNI-qUxy6XHnLkk'); RETURN = events;"]
}`);
  console.error("IMPORTANT: The query array must contain a single string with ALL statements joined with semicolons;");
  console.error("the statements should NOT be split into separate array elements.");
  console.error("NOTE: Some MCP clients may wrap the query in an additional array. The server attempts to detect");
  console.error("and handle this automatically but may produce confusing error messages if detection fails.");

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ActivityWatch MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
