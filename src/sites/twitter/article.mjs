import { getTwitterThreadUrl, runTwitterDumpForUrl } from "./adapters.mjs";

export async function runTwitterArticle(flags) {
  return runTwitterDumpForUrl(flags, getTwitterThreadUrl(flags));
}
