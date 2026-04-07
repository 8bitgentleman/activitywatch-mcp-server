import axios from 'axios';
import { AW_API_BASE } from "./config.js";

export interface Category {
  name: string[];
  rule: {
    type: "regex" | "none";
    regex?: string;
    ignore_case?: boolean;
  };
  data?: {
    color?: string;
    score?: number;
  };
}

// ─── GET CATEGORIES ───────────────────────────────────────────────────────────

export const activitywatch_get_categories_tool = {
  name: "activitywatch_get_categories",
  description: "Get all ActivityWatch categories (classification rules). Returns the list of categories with their regex rules used to classify window events.",
  inputSchema: {
    type: "object",
    properties: {}
  },

  handler: async (_args: Record<string, never>) => {
    try {
      const response = await axios.get(`${AW_API_BASE}/settings/classes`);
      const categories: Category[] = response.data ?? [];
      return {
        content: [{ type: "text", text: JSON.stringify(categories, null, 2) }]
      };
    } catch (error) {
      return handleError("fetch categories", error);
    }
  }
};

// ─── ADD CATEGORY ─────────────────────────────────────────────────────────────

export const activitywatch_add_category_tool = {
  name: "activitywatch_add_category",
  description: "Add a new category to ActivityWatch. The category will be appended to the existing list.",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "array",
        items: { type: "string" },
        description: "Category name hierarchy, e.g. [\"Work\", \"Programming\"]",
        minItems: 1
      },
      regex: {
        type: "string",
        description: "Regex pattern to match app names / window titles (pipe-separated for OR). Required unless rule_type is 'none'."
      },
      ignore_case: {
        type: "boolean",
        description: "Whether the regex match is case-insensitive (default: true)"
      },
      rule_type: {
        type: "string",
        enum: ["regex", "none"],
        description: "Rule type: 'regex' (default) or 'none' for parent-only categories"
      },
      color: {
        type: "string",
        description: "Optional hex color for the category, e.g. '#FF0000'"
      },
      score: {
        type: "number",
        description: "Optional productivity score for the category"
      }
    },
    required: ["name"]
  },

  handler: async (args: {
    name: string[];
    regex?: string;
    ignore_case?: boolean;
    rule_type?: "regex" | "none";
    color?: string;
    score?: number;
  }) => {
    try {
      const existing: Category[] = (await axios.get(`${AW_API_BASE}/settings/classes`)).data ?? [];

      const rule_type = args.rule_type ?? (args.regex ? "regex" : "none");
      const newCategory: Category = {
        name: args.name,
        rule: {
          type: rule_type,
          ...(rule_type === "regex" && args.regex ? { regex: args.regex } : {}),
          ...(rule_type === "regex" ? { ignore_case: args.ignore_case ?? true } : {})
        }
      };

      if (args.color || args.score !== undefined) {
        newCategory.data = {};
        if (args.color) newCategory.data.color = args.color;
        if (args.score !== undefined) newCategory.data.score = args.score;
      }

      await axios.post(`${AW_API_BASE}/settings/classes`, [...existing, newCategory]);

      return {
        content: [{
          type: "text",
          text: `Category "${args.name.join(" > ")}" added successfully.\n${JSON.stringify(newCategory, null, 2)}`
        }]
      };
    } catch (error) {
      return handleError("add category", error);
    }
  }
};

// ─── UPDATE CATEGORY ──────────────────────────────────────────────────────────

export const activitywatch_update_category_tool = {
  name: "activitywatch_update_category",
  description: "Update an existing ActivityWatch category by its name path. Replaces the matching category with new values.",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "array",
        items: { type: "string" },
        description: "Name path of the category to update, e.g. [\"Work\", \"Programming\"]",
        minItems: 1
      },
      regex: {
        type: "string",
        description: "New regex pattern"
      },
      ignore_case: {
        type: "boolean",
        description: "Whether the regex is case-insensitive"
      },
      rule_type: {
        type: "string",
        enum: ["regex", "none"],
        description: "Rule type"
      },
      color: {
        type: "string",
        description: "Optional hex color"
      },
      score: {
        type: "number",
        description: "Optional productivity score"
      }
    },
    required: ["name"]
  },

  handler: async (args: {
    name: string[];
    regex?: string;
    ignore_case?: boolean;
    rule_type?: "regex" | "none";
    color?: string;
    score?: number;
  }) => {
    try {
      const existing: Category[] = (await axios.get(`${AW_API_BASE}/settings/classes`)).data ?? [];
      const idx = existing.findIndex(c => JSON.stringify(c.name) === JSON.stringify(args.name));

      if (idx === -1) {
        return {
          content: [{
            type: "text",
            text: `Category "${args.name.join(" > ")}" not found.`
          }],
          isError: true
        };
      }

      const existing_cat = existing[idx];
      const rule_type = args.rule_type ?? existing_cat.rule.type;
      const updated: Category = {
        name: args.name,
        rule: {
          type: rule_type,
          ...(rule_type === "regex"
            ? {
                regex: args.regex ?? existing_cat.rule.regex,
                ignore_case: args.ignore_case ?? existing_cat.rule.ignore_case ?? true
              }
            : {})
        }
      };

      if (args.color || args.score !== undefined || existing_cat.data) {
        updated.data = { ...existing_cat.data };
        if (args.color) updated.data!.color = args.color;
        if (args.score !== undefined) updated.data!.score = args.score;
      }

      const updated_list = [...existing];
      updated_list[idx] = updated;
      await axios.post(`${AW_API_BASE}/settings/classes`, updated_list);

      return {
        content: [{
          type: "text",
          text: `Category "${args.name.join(" > ")}" updated.\n${JSON.stringify(updated, null, 2)}`
        }]
      };
    } catch (error) {
      return handleError("update category", error);
    }
  }
};

// ─── DELETE CATEGORY ──────────────────────────────────────────────────────────

export const activitywatch_delete_category_tool = {
  name: "activitywatch_delete_category",
  description: "Delete an ActivityWatch category by its name path.",
  inputSchema: {
    type: "object",
    properties: {
      name: {
        type: "array",
        items: { type: "string" },
        description: "Name path of the category to delete, e.g. [\"Work\", \"Programming\"]",
        minItems: 1
      }
    },
    required: ["name"]
  },

  handler: async (args: { name: string[] }) => {
    try {
      const existing: Category[] = (await axios.get(`${AW_API_BASE}/settings/classes`)).data ?? [];
      const filtered = existing.filter(c => JSON.stringify(c.name) !== JSON.stringify(args.name));

      if (filtered.length === existing.length) {
        return {
          content: [{
            type: "text",
            text: `Category "${args.name.join(" > ")}" not found.`
          }],
          isError: true
        };
      }

      await axios.post(`${AW_API_BASE}/settings/classes`, filtered);
      return {
        content: [{
          type: "text",
          text: `Category "${args.name.join(" > ")}" deleted successfully.`
        }]
      };
    } catch (error) {
      return handleError("delete category", error);
    }
  }
};

// ─── SHARED ERROR HANDLER ─────────────────────────────────────────────────────

export function handleError(operation: string, error: unknown) {
  if (axios.isAxiosError(error)) {
    const msg = error.response
      ? `Failed to ${operation}: ${error.message} (Status: ${error.response.status})\n${JSON.stringify(error.response.data)}`
      : `Failed to ${operation}: ${error.message}\nIs ActivityWatch running at http://localhost:5600?`;
    return { content: [{ type: "text", text: msg }], isError: true };
  }
  const msg = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text", text: `Failed to ${operation}: ${msg}` }], isError: true };
}
