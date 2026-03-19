import { getApi } from "./_base";
import type {
  DocumentRouteStepsResponse,
  WorkflowActionCode,
  WorkflowActionResult,
  AvailableActionsResponse,
  WorkflowTask,
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
): Promise<WorkflowActionResult> {
  try {
    const api = await getApi();
    const res = await api.post(`/document-versions/${versionId}/actions`, {
      action,
      note,
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
): Promise<WorkflowActionCode[]> {
  try {
    const api = await getApi();
    const res = await api.get(
      `/document-versions/${versionId}/available-actions`,
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
    return res.data as WorkflowTask[];
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
