import { RestEndpointMethodTypes } from "@octokit/plugin-rest-endpoint-methods";
import type { Comment } from "../schema.js";
import {
  processCodeRabbitReview,
  type CodeRabbitOptions,
} from "./coderabbit.js";

// Type aliases for better readability
type ReviewList =
  RestEndpointMethodTypes["pulls"]["listReviews"]["response"]["data"];

/**
 * Parse review bodies for actionable comments from AI review tools.
 *
 * This function only parses reviews from specific AI tools (currently CodeRabbit AI only).
 * It checks the review author to determine if it should parse the review body.
 *
 * @param reviews - Array of GitHub reviews
 * @param pr - Pull request information
 * @param pr.owner - Repository owner
 * @param pr.repo - Repository name
 * @param pr.number - Pull request number
 * @param coderabbitOptions - CodeRabbit-specific options
 * @param includeStatusIndicators - Whether to include status indicators
 * @returns Array of parsed actionable comments
 */
export function parseReviewBodiesForActionableComments(
  reviews: ReviewList,
  pr: { owner: string; repo: string; number: number },
  coderabbitOptions?: CodeRabbitOptions,
  includeStatusIndicators?: boolean,
): Comment[] {
  const actionableComments: Comment[] = [];

  for (const review of reviews) {
    if (!review.body || review.state === "PENDING") {
      continue;
    }

    const author = review.user?.login ?? null;
    const authorAssociation = review.author_association || "NONE";
    const isBot = review.user?.type === "Bot";

    // ONLY parse CodeRabbit AI review bodies - check author is CodeRabbit
    if (author) {
      const codeRabbitComments = processCodeRabbitReview(
        review.body,
        review,
        pr,
        author,
        authorAssociation,
        isBot,
        coderabbitOptions,
        includeStatusIndicators,
      );
      actionableComments.push(...codeRabbitComments);
    }

    // Add support for other AI review tools here in the future
    // e.g., GitHub Copilot, SonarQube, etc.
    // Each tool should have its own author check and parser function
  }
  return actionableComments;
}
