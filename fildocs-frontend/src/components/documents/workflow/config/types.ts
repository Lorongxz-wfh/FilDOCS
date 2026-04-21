
export type HeaderActionButton = {
  key: string;
  label: string;
  variant: "primary" | "danger" | "outline";
  disabled?: boolean;
  loading?: boolean;
  skipConfirm?: boolean;
  confirmMessage?: string;
  icon?: any;
  onClick: (note?: string) => Promise<void> | void;
};

export type WorkflowHeaderState = {
  title: string;
  code: string;
  status: string;
  versionNumber: number;
  canAct: boolean;
  isTasksReady: boolean;
  headerActions: HeaderActionButton[];
  versionActions: HeaderActionButton[];

  // Impersonation
  routingUsers?: any[];
  actingAsUserId?: number;
  isLoadingRoutingUsers?: boolean;
  setActingAsUserId?: (id: number | undefined) => void;
};
