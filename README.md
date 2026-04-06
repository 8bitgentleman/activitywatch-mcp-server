# ActivityWatch MCP Server

A Model Context Protocol (MCP) server that connects to
[ActivityWatch](https://activitywatch.net/), allowing LLMs like Claude to
interact with your time tracking data.

<a href="https://glama.ai/mcp/servers/msnzvab06f">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/msnzvab06f/badge" alt="ActivityWatch Server MCP server" />
</a>

## Features

- **List Buckets**: View all available ActivityWatch buckets
- **Run Queries**: Execute powerful AQL (ActivityWatch Query Language) queries
- **Get Raw Events**: Retrieve events directly from any bucket
- **Get Settings**: Access ActivityWatch configuration settings

## Installation

You can install the ActivityWatch MCP server either from npm or by building it yourself.

### Installing from npm (coming soon)

```bash
# Global installation
npm install -g activitywatch-mcp-server

# Or install locally
npm install activitywatch-mcp-server
```

### Building from Source

1. Clone this repository:

   ```bash
   git clone https://github.com/8bitgentleman/activitywatch-mcp-server.git
   cd activitywatch-mcp-server
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the project:

   ```bash
   npm run build
   ```

## Prerequisites

- [ActivityWatch](https://activitywatch.net/) installed and running
- Node.js (v14 or higher)
- Claude for Desktop (or any other MCP client)

## Usage

### Using with Claude for Desktop

1. Open your Claude for Desktop configuration file:
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`

1. Add the MCP server configuration:

    ```json
    {
    "mcpServers": {
        "activitywatch": {
        "command": "activitywatch-mcp-server",
        "args": []
        }
    }
    }
    ```

    If you built from source, use:

    ```json
    {
    "mcpServers": {
        "activitywatch": {
        "command": "node",
        "args": ["/path/to/activitywatch-mcp-server/dist/index.js"]
        }
    }
    }
    ```

1. Restart Claude for Desktop

1. Look for the MCP icon in Claude's interface to confirm it's working

### Using a rootless podman container on Linux with Gemini CLI

Make sure to build the image first with:

```sh
version=$(npm pkg get version | tr -d '"')
podman build . -t activitywatch-mcp-server:${version}
```

This example uses the override for Activity Watch not being available on
`127.0.0.1` (see next section). If not required, you may omit the `AW_API_BASE`
environment variable.

```json
{
  "mcpServers": {
    "activitywatch-mcp-server": {
      "command": "/usr/bin/podman",
      "args": [
        "run",
        "--rm",
        "--interactive",
        "--userns=keep-id",
        "-e",
        "AW_API_BASE",
        "localhost/activitywatch-mcp-server:1.2.1"
      ],
      "env": {
        "AW_API_BASE": "http://mydesktop.local:5600/api/0"
      }
    }
  }
}
```

### Override ActivityWatch server host/port

If you want to run this MCP server from inside Windows Subsystem for Linux,
for instance within a container, the AW server running in Windows will not be
available at `127.0.0.1`. To override the standard localhost connection, use the
environment variable `AW_API_BASE` or the `--aw-api-base` flag, as below:

```sh
# Using environment variable
export AW_API_BASE=http://mydesktop.local:5600/api/0
node dist/index.js

# Or using command-line flag
node dist/index.js --aw-api-base=http://mydesktop.local:5600/api/0
```

NOTE: The AW server may be fussy about the name used to connect to it, but it
will accept a name that matches the computer name where it is running with a
`.local` suffix.

### Example Queries

Here are some example queries you can try in Claude:

- **List all your buckets**: "What ActivityWatch buckets do I have?"
- **Get application usage summary**: "Can you show me which applications I've
used the most today?"
- **View browsing history**: "What websites have I spent the most time on today?"
- **Check productivity**: "How much time have I spent in productivity apps today?"
- **View settings**: "What are my ActivityWatch settings?" or "Can you check a
specific setting in ActivityWatch?"

## Available Tools

### list-buckets

Lists all available ActivityWatch buckets with optional type filtering.

Parameters:

- `type` (optional): Filter buckets by type (e.g., "window", "web", "afk")
- `includeData` (optional): Include bucket data in response

### run-query

Run a query in ActivityWatch's query language (AQL).

Parameters:

- `timeperiods`: Time period(s) to query formatted as array of strings. For date
ranges, use format: `["2024-10-28/2024-10-29"]`
- `query`: Array of query statements in ActivityWatch Query Language, where each
item is a complete query with statements separated by semicolons
- `name` (optional): Name for the query (used for caching)

**IMPORTANT**: Each query string should contain a complete query with multiple
statements separated by semicolons.

Example request format:

```json
{
  "timeperiods": ["2024-10-28/2024-10-29"],
  "query": ["events = query_bucket('aw-watcher-window_UNI-qUxy6XHnLkk'); RETURN = events;"]
}
```

Note that:

- `timeperiods` should have pre-formatted date ranges with slashes
- Each item in the `query` array is a complete query with all statements

### get-events

Get raw events from an ActivityWatch bucket.

Parameters:

- `bucketId`: ID of the bucket to fetch events from
- `start` (optional): Start date/time in ISO format
- `end` (optional): End date/time in ISO format
- `limit` (optional): Maximum number of events to return

### get-settings

Get ActivityWatch settings from the server.

Parameters:

- `key` (optional): Get a specific settings key instead of all settings

## Query Language Examples

ActivityWatch uses a simple query language. Here are some common patterns:

```
// Get window events
window_events = query_bucket(find_bucket("aw-watcher-window_"));
RETURN = window_events;

// Get only when not AFK
afk_events = query_bucket(find_bucket("aw-watcher-afk_"));
not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);
window_events = filter_period_intersect(window_events, not_afk);
RETURN = window_events;

// Group by app
window_events = query_bucket(find_bucket("aw-watcher-window_"));
events_by_app = merge_events_by_keys(window_events, ["app"]);
RETURN = sort_by_duration(events_by_app);

// Filter by app name
window_events = query_bucket(find_bucket("aw-watcher-window_"));
code_events = filter_keyvals(window_events, "app", ["Code"]);
RETURN = code_events;
```

## Configuration

The server connects to the ActivityWatch API at `http://localhost:5600` by
default. If your ActivityWatch instance is running on a different host or port,
you can override it as described in the Override ActivityWatch server host/port
section above.

## Troubleshooting

### ActivityWatch Not Running

If ActivityWatch isn't running, the server will show connection errors. Make
sure ActivityWatch is running and accessible at the specified host/port
address (`http://localhost:5600` unless you have overridden it).

### Query Errors

If you're encountering query errors:

1. Check your query syntax
2. Make sure the bucket IDs are correct
3. Verify that the timeperiods contain data
4. Check ActivityWatch logs for more details

### Claude/MCP Query Formatting Issues

If Claude reports errors when running queries through this MCP server, it's
likely due to formatting issues. Make sure your query follows this exact format
in your prompts:

```json
{
  "timeperiods": ["2024-10-28/2024-10-29"],
  "query": ["events = query_bucket('aw-watcher-window_UNI-qUxy6XHnLkk'); RETURN = events;"]
}
```

Common issues:

- Time periods not formatted correctly (should be "start/end" in a single string
within an array)
- **Query statements split into separate array elements instead of being combined
in one string**

#### The Most Common Formatting Issue

The most frequent error is when Claude splits each query statement into its own
array element like this:

```json
{
  "query": [
    "browser_events = query_bucket('aw-watcher-web');",
    "afk_events = query_bucket('aw-watcher-afk');",
    "RETURN = events;"
  ],
  "timeperiods": ["2024-10-28/2024-10-29"]
}
```

This is INCORRECT. Instead, all statements should be in a single string within
the array:

```json
{
  "timeperiods": ["2024-10-28/2024-10-29"],
  "query": ["browser_events = query_bucket('aw-watcher-web'); afk_events = query_bucket('aw-watcher-afk'); RETURN = events;"]
}
```

#### When Prompting Claude

When prompting Claude, be very explicit about the format and use examples. For
instance, say:

"Run a query with timeperiods as `["2024-10-28/2024-10-29"]` and query as
`["statement1; statement2; RETURN = result;"]`. Important: Make sure ALL query
statements are in a single string within the array, not split into separate
array elements."

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT](LICENSE)
