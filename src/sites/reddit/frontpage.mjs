import { runRedditHot } from "./hot.mjs";

export async function runRedditFrontpage(flags) {
  await runRedditHot({ ...flags, subreddit: "" });
}
