import { getTwitterThreadUrl, runTwitterReadForUrl } from "./adapters.mjs";

export async function runTwitterThread(flags) {
  return runTwitterReadForUrl(flags, getTwitterThreadUrl(flags));
}
