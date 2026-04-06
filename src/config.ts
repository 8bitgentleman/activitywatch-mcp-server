export const DEFAULT_API_BASE = "http://localhost:5600/api/0";

// Look for a URL passed as a command-line argument (e.g., --aw-api-base=http://localhost:5600/api/0)
const args = process.argv.slice(2);
const apiBaseIndex = args.indexOf('--aw-api-base');
const urlArg = apiBaseIndex !== -1 && apiBaseIndex + 1 < args.length
    ? args[apiBaseIndex + 1]
    : args.find((arg) => arg.startsWith('--aw-api-base='))?.substring('--aw-api-base='.length);

// Fall back to environment variable or default
export const AW_API_BASE = urlArg || process.env.AW_API_BASE || DEFAULT_API_BASE;
