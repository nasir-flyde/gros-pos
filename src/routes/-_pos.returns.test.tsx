import { describe, expect, it } from "vitest";
import { isRedirect } from "@tanstack/react-router";
import { Route } from "./_pos.returns";

describe("legacy returns URL", () => {
  it("replaces /returns with the Orders return/refund workflow", () => {
    const beforeLoad = Route.options.beforeLoad as () => never;
    try {
      beforeLoad();
      throw new Error("Expected a redirect");
    } catch (error) {
      expect(isRedirect(error)).toBe(true);
      expect(error).toMatchObject({ options: { to: "/orders", replace: true } });
    }
  });
});
