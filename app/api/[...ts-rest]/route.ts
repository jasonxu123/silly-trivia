import { createNextHandler } from "@ts-rest/serverless/next";
import { timeContract } from "@/lib/contracts/time";

const router = {
  getTime: async () => {
    const now = new Date();
    return {
      status: 200 as const,
      body: {
        iso: now.toISOString(),
        timestamp: now.getTime(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };
  },
};

const handler = createNextHandler(timeContract, router, {
  basePath: "/api",
  handlerType: "app-router",
});

export { handler as GET, handler as POST, handler as PUT, handler as PATCH, handler as DELETE };
