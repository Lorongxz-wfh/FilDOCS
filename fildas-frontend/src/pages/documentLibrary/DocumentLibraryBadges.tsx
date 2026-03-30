import { FileStack, Users } from "lucide-react";
import { TypePill, StatusBadge } from "../../components/ui/Badge";

export function TypeBadge({ type }: { type: string }) {
  return <TypePill label={type ? type.charAt(0).toUpperCase() + type.slice(1).toLowerCase() : "—"} />;
}

export function ModeBadge({ mode }: { mode: string }) {
  const isMultiDoc = mode === "multi_doc";
  return (
    <TypePill
      label={isMultiDoc ? "Multi-doc" : "Multi-office"}
      icon={isMultiDoc ? <FileStack className="h-2.5 w-2.5" /> : <Users className="h-2.5 w-2.5" />}
    />
  );
}

export function SourceBadge({ source }: { source: "created" | "requested" | "shared" }) {
  return <TypePill label={source.charAt(0).toUpperCase() + source.slice(1)} />;
}