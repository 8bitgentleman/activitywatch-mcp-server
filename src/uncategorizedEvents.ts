import axios from 'axios';
import { AW_API_BASE } from "./config.js";

export interface UncategorizedSummary {
  app: string;
  title: string;
  duration_seconds: number;
}

interface Category {
  name: string[];
  rule: { type: string; regex?: string; ignore_case?: boolean };
}

/**
 * Client-side categorization: returns true if the event matches any category rule.
 */
function matchesAnyCategory(app: string, title: string, categories: Category[]): boolean {
  // NOTE: AW's own categorization engine tests the regex against the `app` and `title` fields
  // individually. Here we test against a single concatenated "app title" string for simplicity.
  // This means a regex like "chrome gmail" would match here but not in the AW UI — a subtle
  // semantic difference that can cause minor discrepancies in what gets flagged as uncategorized.
  const combined = `${app} ${title}`;
  for (const cat of categories) {
    if (cat.rule.type !== "regex" || !cat.rule.regex) continue;
    try {
      const flags = cat.rule.ignore_case !== false ? "i" : "";
      const re = new RegExp(cat.rule.regex, flags);
      if (re.test(combined)) return true;
    } catch {
      // skip invalid regex
    }
  }
  return false;
}

export const activitywatch_get_uncategorized_events_tool = {
  name: "activitywatch_get_uncategorized_events",
  description:
    "Fetch window events that have NOT been matched by any category rule, grouped and sorted by total duration. " +
    "Use this to discover what activities need new category rules. " +
    "Returns the top N app+title combinations by time spent.",
  inputSchema: {
    type: "object",
    properties: {
      start: {
        type: "string",
        description: "Start of the time range in ISO format, e.g. '2024-01-01'. Defaults to 30 days ago."
      },
      end: {
        type: "string",
        description: "End of the time range in ISO format, e.g. '2024-12-31'. Defaults to now."
      },
      limit: {
        type: "number",
        description: "Maximum number of distinct app+title combinations to return, sorted by duration (default: 50)"
      },
      min_seconds: {
        type: "number",
        description: "Only include combinations with at least this many seconds of total activity (default: 30)"
      }
    }
  },

  handler: async (args: {
    start?: string;
    end?: string;
    limit?: number;
    min_seconds?: number;
  }) => {
    try {
      const limit = args.limit ?? 50;
      const min_seconds = args.min_seconds ?? 30;

      const end = args.end ? new Date(args.end) : new Date();
      const start = args.start
        ? new Date(args.start)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

      const timeperiod = `${start.toISOString().slice(0, 10)}/${end.toISOString().slice(0, 10)}`;

      // Fetch categories for client-side filtering
      let categories: Category[] = [];
      try {
        const resp = await axios.get(`${AW_API_BASE}/settings/classes`);
        categories = resp.data ?? [];
      } catch {
        // proceed without categories — all events will be shown
      }

      // Query window events filtered by non-AFK periods (standard AW pattern, works across versions)
      const query = [
        `window_events = query_bucket(find_bucket("aw-watcher-window_"));`,
        `afk_events = query_bucket(find_bucket("aw-watcher-afk_"));`,
        `not_afk = filter_keyvals(afk_events, "status", ["not-afk"]);`,
        `events = filter_period_intersect(window_events, not_afk);`,
        `RETURN = events;`
      ].join(" ");

      const response = await axios.post(`${AW_API_BASE}/query/`, {
        query: [query],
        timeperiods: [timeperiod]
      });

      const rawEvents: any[] = Array.isArray(response.data?.[0])
        ? response.data[0]
        : (response.data?.[0]?.events ?? []);

      // Aggregate by app + title, filtering out categorized events client-side
      const map = new Map<string, UncategorizedSummary>();
      let totalAll = 0;

      for (const ev of rawEvents) {
        const app: string = ev.data?.app ?? "(unknown)";
        const title: string = ev.data?.title ?? "";
        const duration: number = ev.duration ?? 0;
        totalAll += duration;

        if (matchesAnyCategory(app, title, categories)) continue;

        const key = `${app}\x00${title}`;
        const existing = map.get(key);
        if (existing) {
          existing.duration_seconds += duration;
        } else {
          map.set(key, { app, title, duration_seconds: duration });
        }
      }

      const allUncategorized = Array.from(map.values());
      // Compute total before filtering/slicing so the label reflects the true uncategorized time
      const totalUncategorized = allUncategorized.reduce((s, e) => s + e.duration_seconds, 0);

      const results: UncategorizedSummary[] = allUncategorized
        .filter(e => e.duration_seconds >= min_seconds)
        .sort((a, b) => b.duration_seconds - a.duration_seconds)
        .slice(0, limit);

      const text = [
        `Uncategorized events: ${start.toISOString().slice(0, 10)} → ${end.toISOString().slice(0, 10)}`,
        `Total active time: ${formatDuration(totalAll)}`,
        `Uncategorized time: ${formatDuration(totalUncategorized)}`,
        `Existing categories applied: ${categories.length}`,
        `Showing top ${results.length} uncategorized app+title pairs (min ${min_seconds}s):`,
        "",
        ...results.map((r, i) =>
          `${i + 1}. [${formatDuration(r.duration_seconds)}] ${r.app} — ${r.title || "(no title)"}`
        )
      ].join("\n");

      return {
        content: [
          { type: "text", text },
          { type: "text", text: "\n\nRaw JSON:\n" + JSON.stringify(results, null, 2) }
        ]
      };
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const msg = error.response
          ? `Failed to fetch uncategorized events: ${error.message} (Status: ${error.response.status})\n${JSON.stringify(error.response.data)}`
          : `Failed to fetch uncategorized events: ${error.message}\nIs ActivityWatch running at http://localhost:5600?`;
        return { content: [{ type: "text", text: msg }], isError: true };
      }
      const msg = error instanceof Error ? error.message : String(error);
      return { content: [{ type: "text", text: `Failed to fetch uncategorized events: ${msg}` }], isError: true };
    }
  }
};

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
