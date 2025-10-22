import { z } from 'zod';
import { PRIdentifierStringSchema } from '../../utils/validation.js';

export const GetFailingTestsSchema = z.object({
  pr: PRIdentifierStringSchema,
  wait: z.boolean().default(false),
  bail_on_first: z.boolean().default(true),
  page: z.number().int().min(1).default(1),
  page_size: z.number().int().min(1).max(50).default(10)
});

export type GetFailingTestsInput = z.infer<typeof GetFailingTestsSchema>;

export interface FailedTest {
  check_name: string;
  test_name: string;
  error_message: string;
  log_url: string;
  file_path?: string;
  line_number?: number;
  confidence: 'high' | 'medium' | 'low';
}

export interface GetFailingTestsOutput {
  pr: string;
  status: 'pending' | 'running' | 'failed' | 'passed' | 'unknown';
  failures: FailedTest[];
  pagination: {
    page: number;
    page_size: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_previous: boolean;
  };
  instructions: {
    summary: string;
    commands: string[];
  };
  poll_info?: {
    message: string;
    retry_after_seconds: number;
  };
}

