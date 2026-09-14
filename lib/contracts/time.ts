import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const timeContract = c.router({
  getTime: {
    method: "GET",
    path: "/time",
    responses: {
      200: z.object({
        iso: z.string(),
        timestamp: z.number(),
        timeZone: z.string(),
      }),
    },
  },
});
