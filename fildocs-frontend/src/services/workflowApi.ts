import { getApi } from "./_base";
import type {
  DocumentRouteStepsResponse,
  WorkflowActionCode,
  WorkflowActionResult,
  AvailableActionsResponse,
  WorkflowTask,
  OfficeUser,
} from "./types";

export async function getDocumentRouteSteps(
  versionId: number,
): Promise<DocumentRouteStepsResponse> {
  try {
    const api = await getApi();
    const res = await api.get(`/document-versions/${versionId}/route-steps`);

    return res.data as DocumentRouteStepsResponse;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load route steps (${status})`
        : "Failed to load route steps");
    throw new Error(msg);
  }
}

export async function submitWorkflowAction(
  versionId: number,
  action: WorkflowActionCode,
  note?: string,
  debug = false,
  actingAsUserId?: number,
): Promise<WorkflowActionResult> {
  try {
    const api = await getApi();
    const res = await api.post(`/document-versions/${versionId}/actions`, {
      action,
      note,
      ...(debug ? { debug: true } : {}),
      acting_as_user_id: actingAsUserId,
    });
    return res.data as WorkflowActionResult;
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status ? `Request failed (${status})` : "Request failed");
    throw new Error(msg);
  }
}

export async function getAvailableActions(
  versionId: number,
  debug = false,
): Promise<WorkflowActionCode[]> {
  try {
    const api = await getApi();
    const res = await api.get(
      `/document-versions/${versionId}/available-actions`,
      debug ? { params: { debug: 1 } } : undefined,
    );
    const data = res.data as AvailableActionsResponse;
    return data.actions ?? [];
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load actions (${status})`
        : "Failed to load actions");
    throw new Error(msg);
  }
}

export async function logOpenedVersion(
  versionId: number,
  source?: string,
): Promise<void> {
  try {
    const api = await getApi();
    await api.post("/activity/opened-version", {
      document_version_id: versionId,
      source: source ?? "versions_panel",
    });
  } catch {
    // Never break UX for logging
  }
}

export async function listWorkflowTasks(
  versionId: number,
): Promise<WorkflowTask[]> {
  try {
    const api = await getApi();
    const res = await api.get(`/document-versions/${versionId}/tasks`);
    const payload = res.data;
    
    if (Array.isArray(payload)) return payload as WorkflowTask[];
    if (payload?.data && Array.isArray(payload.data)) return payload.data as WorkflowTask[];
    if (payload?.tasks && Array.isArray(payload.tasks)) return payload.tasks as WorkflowTask[];
    
    if (payload && typeof payload === "object" && payload.id && payload.phase) {
      return [payload] as WorkflowTask[];
    }
    
    return [] as WorkflowTask[];
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load workflow tasks (${status})`
        : "Failed to load workflow tasks");
    throw new Error(msg);
  }
}

export async function listRoutingUsers(
  versionId: number,
): Promise<OfficeUser[]> {
  try {
    const api = await getApi();
    const res = await api.get(`/document-versions/${versionId}/routing-users`);
    const data = res.data;
    return (Array.isArray(data) ? data : data?.data ?? []) as OfficeUser[];
  } catch (e: any) {
    const status = e?.response?.status;
    const msg =
      e?.response?.data?.message ||
      (status
        ? `Failed to load routing users (${status})`
        : "Failed to load routing users");
    throw new Error(msg);
  }
}
