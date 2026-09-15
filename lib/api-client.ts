import { initClient } from "@ts-rest/core";
import { timeContract } from "@/lib/contracts/time";
import { graderContract } from "@/lib/contracts/grader";

export const apiClient = initClient({ ...timeContract, ...graderContract }, {
  baseUrl: "/api",
});
