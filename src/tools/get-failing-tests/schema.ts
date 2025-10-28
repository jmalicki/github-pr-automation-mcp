import { z } from "zod";
import { PRIdentifierStringSchema } from "../../utils/validation.js";

export const GetFailingTestsSchema = z.object({
  pr: PRIdentifierStringSchema,
  wait: z.boolean().default(false),
  bail_on_first: z.boolean().default(true),
  cursor: z.string().optional(), // MCP cursor-based pagination
  detailed_logs: z.boolean().default(false), // Enable detailed log parsing from workflow runs
});

export type GetFailingTestsInput = z.infer<typeof GetFailingTestsSchema>;

export interface FailedTest {
  check_name: string;
  test_name: string;
  error_message: string;
  log_url: string;
  file_path?: string;
  line_number?: number;
  confidence: "high" | "medium" | "low";
}

export interface GetFailingTestsOutput {
  pr: string;
  status: "pending" | "running" | "failed" | "passed" | "unknown";
  failures: FailedTest[];
  nextCursor?: string; // MCP cursor-based pagination
  instructions: {
    summary: string;
    commands: string[];
  };
  poll_info?: {
    message: string;
    retry_after_seconds: number;
  };
}
