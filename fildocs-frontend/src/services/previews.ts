let apiPromise: Promise<typeof import("./api")> | null = null;

async function getApi() {
  if (!apiPromise) apiPromise = import("./api");
  const mod = await apiPromise;
  return mod.default;
}

export type TempPreview = {
  id: string;
  year: number;
  url: string;
};

export async function createTempPreview(file: File): Promise<TempPreview> {
  const form = new FormData();
  form.append("file", file);

  // IMPORTANT: do NOT manually set Content-Type for FormData;
  // axios will set multipart boundary correctly.
  const api = await getApi();
  const res = await api.post("/previews", form);

  if (!res.data.url) throw new Error("Preview not available for this file type.");
  return res.data as TempPreview;
}

export async function deleteTempPreview(
  year: number,
  id: string,
): Promise<void> {
  const api = await getApi();
  await api.delete(`/previews/${year}/${id}`);
}
