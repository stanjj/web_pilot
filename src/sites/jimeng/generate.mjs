import { runUiGatedWrite } from "../../core/ui-site.mjs";

export async function runJimengGenerate(flags) {
  return runUiGatedWrite(flags, {
    action: "generate",
    label: "Jimeng image generation",
  });
}
