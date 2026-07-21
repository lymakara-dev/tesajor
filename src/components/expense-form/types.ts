import type { CreateExpenseInput } from "@/lib/validation/expenses";

export interface ExpenseFormMember {
  id: string;
  displayName: string;
}

type DistributiveOmit<T, K extends keyof T> = T extends unknown ? Omit<T, K> : never;

export type ExpenseFormInitialValues = DistributiveOmit<CreateExpenseInput, "groupId">;
