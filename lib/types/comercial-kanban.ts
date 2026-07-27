import type { DashboardFilterOptions, DashboardFilters } from "@/lib/dashboard-filters";

export type ComercialKanbanCard = {
  id: string;
  bitrixDealId: string;
  title: string;
  value: number;
  assignedTo: string;
  team: string;
  roulette: string;
  enteredAt: string;
  updatedAt: string;
  stageId: string;
  bitrixUrl: string | null;
};

export type ComercialKanbanStage = {
  id: string;
  name: string;
  semantics: "S" | "F" | "P" | null;
  cards: ComercialKanbanCard[];
};

export type ComercialKanbanData = {
  filters: DashboardFilters;
  filterOptions: DashboardFilterOptions;
  stages: ComercialKanbanStage[];
  total: number;
  canMove: boolean;
  brokers: Array<{ id: string; name: string; team: string }>;
  generatedAt: string;
};
