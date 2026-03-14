import api from "./api";

export interface SearchResultItem {
  type:
    | "document"
    | "user"
    | "office"
    | "page"
    | "template"
    | "request"
    | "notification";
  id: number | string;
  title: string;
  description?: string;
  meta?: string;
  url: string;
}

export interface SearchResults {
  documents: SearchResultItem[];
  users: SearchResultItem[];
  offices: SearchResultItem[];
  templates: SearchResultItem[];
  requests: SearchResultItem[];
  notifications: SearchResultItem[];
}

export async function globalSearch(q: string): Promise<SearchResults> {
  const { data } = await api.get("/search", { params: { q } });
  return {
    documents: data.documents ?? [],
    users: data.users ?? [],
    offices: data.offices ?? [],
    templates: data.templates ?? [],
    requests: data.requests ?? [],
    notifications: data.notifications ?? [],
  };
}
