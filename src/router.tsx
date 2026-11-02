import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

import { posMaintenanceAccess, isPosAccessError } from "./lib/pos-maintenance";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (count, error) =>
          posMaintenanceAccess.canUsePos() && !isPosAccessError(error) && count < 3,
      },
      mutations: { retry: false },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
