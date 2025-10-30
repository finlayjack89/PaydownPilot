import { useQuery } from "@tanstack/react-query";
import { Account, PlanResponse } from "@shared/schema";

export const useAccounts = () => {
  return useQuery<Account[]>({
    queryKey: ["/api/accounts"],
  });
};

export const useActivePlan = (options: { enabled?: boolean } = {}) => {
  return useQuery<PlanResponse | null>({
    queryKey: ["/api/plans/latest"],
    retry: false,
    ...options,
  });
};
