import { initClient } from "@ts-rest/core";
import { timeContract } from "@/lib/contracts/time";

export const apiClient = initClient(timeContract, {
  baseUrl: "/api",
});
