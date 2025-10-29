#!/usr/bin/env node

/**
 * Generate test data files from a GitHub PR
 *
 * Usage: node generate-test-data.js <owner/repo#number>
 * Example: node generate-test-data.js jmalicki/subagent-worktree-mcp#1
 */

import { promises as fs } from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    console.error("Usage: node generate-test-data.js <owner/repo#number>");
    console.error(
      "Example: node generate-test-data.js jmalicki/subagent-worktree-mcp#1",
    );
    process.exit(1);
  }

  const prIdentifier = args[0];
  const [ownerRepo, number] = prIdentifier.split("#");
  const [owner, repo] = ownerRepo.split("/");

  if (!owner || !repo || !number) {
    console.error("Invalid PR identifier format. Use: owner/repo#number");
    process.exit(1);
  }

  console.log(`Generating test data for ${owner}/${repo}#${number}...`);

  const testDataDir = __dirname;

  // Create directories
  await fs.mkdir(path.join(testDataDir, "review-comments"), {
    recursive: true,
  });

  try {
    // 1. Get all reviews
    console.log("Fetching reviews...");
    const reviewsQuery = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            reviews(first: 100) {
              nodes {
                id
                databaseId
                body
                state
                author { login }
                createdAt
                updatedAt
              }
            }
          }
        }
      }
    `;

    const reviewsResult = execSync(
      `gh api graphql -f query='${reviewsQuery}' -F owner="${owner}" -F repo="${repo}" -F number=${number}`,
      { encoding: "utf8" },
    );

    const reviewsData = JSON.parse(reviewsResult);
    const reviews = reviewsData.data.repository.pullRequest.reviews.nodes;

    // 2. Get all issue comments
    console.log("Fetching issue comments...");
    const commentsQuery = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            comments(first: 100) {
              nodes {
                id
                databaseId
                body
                author { login }
                createdAt
                updatedAt
              }
            }
          }
        }
      }
    `;

    const commentsResult = execSync(
      `gh api graphql -f query='${commentsQuery}' -F owner="${owner}" -F repo="${repo}" -F number=${number}`,
      { encoding: "utf8" },
    );

    const commentsData = JSON.parse(commentsResult);
    const issueComments =
      commentsData.data.repository.pullRequest.comments.nodes;

    // 3. Get all review comments
    console.log("Fetching review comments...");
    const reviewCommentsQuery = `
      query($owner: String!, $repo: String!, $number: Int!) {
        repository(owner: $owner, name: $repo) {
          pullRequest(number: $number) {
            reviewThreads(first: 100) {
              nodes {
                id
                comments(first: 100) {
                  nodes {
                    id
                    databaseId
                    body
                    path
                    originalPosition
                    diffHunk
                    createdAt
                    updatedAt
                    author { login }
                    pullRequestReview { id databaseId }
                  }
                }
              }
            }
          }
        }
      }
    `;

    const reviewCommentsResult = execSync(
      `gh api graphql -f query='${reviewCommentsQuery}' -F owner="${owner}" -F repo="${repo}" -F number=${number}`,
      { encoding: "utf8" },
    );

    const reviewCommentsData = JSON.parse(reviewCommentsResult);
    const reviewThreads =
      reviewCommentsData.data.repository.pullRequest.reviewThreads.nodes;

    // 4. Save review files
    console.log("Saving review files...");
    for (const review of reviews) {
      const filename = `review-${review.id}.json`;
      const filepath = path.join(testDataDir, filename);
      await fs.writeFile(
        filepath,
        JSON.stringify({ data: { node: review } }, null, 2),
      );
      console.log(`  Saved ${filename}`);
    }

    // 5. Save issue comment files
    console.log("Saving issue comment files...");
    for (const comment of issueComments) {
      const filename = `issue-comment-${comment.id}.json`;
      const filepath = path.join(testDataDir, filename);
      await fs.writeFile(
        filepath,
        JSON.stringify({ data: { node: comment } }, null, 2),
      );
      console.log(`  Saved ${filename}`);
    }

    // 6. Save review comment files
    console.log("Saving review comment files...");
    const reviewCommentsDir = path.join(testDataDir, "review-comments");
    for (const thread of reviewThreads) {
      for (const comment of thread.comments.nodes) {
        const filename = `${comment.id}.json`;
        const filepath = path.join(reviewCommentsDir, filename);
        await fs.writeFile(
          filepath,
          JSON.stringify({ data: { node: comment } }, null, 2),
        );
        console.log(`  Saved review-comments/${filename}`);
      }
    }

    // 7. Generate file-expected.json (all actionable by default)
    console.log("Generating file-expected.json...");
    const expectations = {};

    // Add reviews
    for (const review of reviews) {
      expectations[`review-${review.id}.json`] = true;
    }

    // Add issue comments
    for (const comment of issueComments) {
      expectations[`issue-comment-${comment.id}.json`] = true;
    }

    // Add review comments
    for (const thread of reviewThreads) {
      for (const comment of thread.comments.nodes) {
        expectations[`review-comments/${comment.id}.json`] = true;
      }
    }

    const expectationsPath = path.join(testDataDir, "file-expected.json");
    await fs.writeFile(expectationsPath, JSON.stringify(expectations, null, 2));

    console.log(`\n✅ Generated test data for ${owner}/${repo}#${number}`);
    console.log(`📁 Files created:`);
    console.log(`   - ${reviews.length} review files`);
    console.log(`   - ${issueComments.length} issue comment files`);
    console.log(
      `   - ${reviewThreads.reduce((sum, thread) => sum + thread.comments.nodes.length, 0)} review comment files`,
    );
    console.log(
      `   - file-expected.json (all marked as actionable by default)`,
    );
    console.log(`\n📝 Next steps:`);
    console.log(`   1. Review the generated files`);
    console.log(
      `   2. Edit file-expected.json to mark non-actionable items as false`,
    );
    console.log(`   3. Run the tests to verify filtering behavior`);
  } catch (error) {
    console.error("Error generating test data:", error.message);
    process.exit(1);
  }
}

main().catch(console.error);
