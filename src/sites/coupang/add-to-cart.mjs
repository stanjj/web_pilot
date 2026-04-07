import { runUiGatedWrite } from "../../core/ui-site.mjs";

export async function runCoupangAddToCart(flags) {
  return runUiGatedWrite(flags, {
    action: "add-to-cart",
    label: "Coupang add to cart",
  });
}
