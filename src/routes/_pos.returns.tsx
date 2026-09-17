import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_pos/returns")({
  beforeLoad: () => {
    throw redirect({ to: "/orders", replace: true });
  },
});
