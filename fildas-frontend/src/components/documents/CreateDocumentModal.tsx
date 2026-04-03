import React, { useMemo, useState } from "react";
import Modal from "../ui/Modal";
import OfficeDropdown from "../OfficeDropdown";
import { getAuthUser } from "../../lib/auth";
import { labelCls, choiceCardCls, helperCls } from "../../utils/formStyles";

export type FlowSelection = {
  routingMode: "default" | "custom";
  reviewOfficeId: number | null;
  customOfficeIds: number[];
};

type Props = {
  open: boolean;
  isQA: boolean;
  initial?: FlowSelection;
  onConfirm: (selection: FlowSelection) => void;
  onClose: () => void;
};

const MAX_CUSTOM = 5;

function buildChain(
  isQA: boolean,
  routingMode: "default" | "custom",
  _reviewOfficeId: number | null,
  customOfficeIds: number[],
  _officeNameById: Record<number, string>,
  officeCodeById: Record<number, string> = {},
): string[] {
  if (routingMode === "custom") {
    // Use office codes, fall back to "O{N}" placeholder for unset rows
    const names = customOfficeIds.map((id, i) =>
      id > 0 ? (officeCodeById[id] ?? `O${i + 1}`) : `O${i + 1}`,
    );
    const creator = isQA ? "QA" : "Your Office";
    const creatorCheck = isQA ? "QA ✓" : "Office ✓";
    return [
      creator,
      ...names,
      creatorCheck,
      ...names,
      creatorCheck,
      "Register",
      "Distribute",
    ];
  }
  if (isQA) {
    return [
      "QA",
      "Office",
      "VP",
      "QA ✓",
      "Office",
      "VP",
      "President",
      "QA ✓",
      "Register",
      "Distribute",
    ];
  }
  return [
    "Your Office",
    "Office Head",
    "VP",
    "Office ✓",
    "Office Head",
    "VP",
    "President",
    "Office ✓",
    "Register",
    "Distribute",
  ];
}

// Splits chain into Review / Approval / Finalization slices
// Review ends after the first "✓" node (inclusive)
function reviewEndIndex(chain: string[]): number {
  const i = chain.findIndex((n) => n.includes("✓"));
  return i === -1 ? Math.ceil(chain.length / 3) : i + 1;
}
// Approval ends after the second "✓" node (inclusive)
function approvalEndIndex(chain: string[]): number {
  const first = chain.findIndex((n) => n.includes("✓"));
  if (first === -1) return Math.ceil((chain.length * 2) / 3);
  const second = chain.findIndex((n, i) => i > first && n.includes("✓"));
  return second === -1 ? first + 1 : second + 1;
}

export default function FlowSelectModal({
  open,
  isQA,
  initial,
  onConfirm,
  onClose,
}: Props) {
  const [routingMode, setRoutingMode] = useState<"default" | "custom">(
    initial?.routingMode ?? "default",
  );
  const [reviewOfficeId, setReviewOfficeId] = useState<number | null>(
    initial?.reviewOfficeId ?? null,
  );
  const [customOfficeIds, setCustomOfficeIds] = useState<number[]>(
    initial?.customOfficeIds?.length ? initial.customOfficeIds : [0],
  );
  const [officeNameById, setOfficeNameById] = useState<Record<number, string>>(
    {},
  );
  const [officeCodeById, setOfficeCodeById] = useState<Record<number, string>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);

  // Exclude the creator's own office from custom recipients
  const myOfficeId: number = Number(getAuthUser()?.office_id ?? 0);

  const customSelectedIds = useMemo(
    () => customOfficeIds.filter((x) => x > 0),
    [customOfficeIds],
  );

  const chain = useMemo(
    () =>
      buildChain(
        isQA,
        routingMode,
        reviewOfficeId,
        customSelectedIds,
        officeNameById,
        officeCodeById,
      ),
    [
      isQA,
      routingMode,
      reviewOfficeId,
      customSelectedIds,
      officeNameById,
      officeCodeById,
    ],
  );

  const validate = (): string | null => {
    if (routingMode === "default") {
      if (isQA && !reviewOfficeId) return "Please select a reviewer office.";
      return null;
    }
    if (customSelectedIds.length < 1) return "Add at least 1 recipient office.";
    if (customOfficeIds.some((x) => x === 0))
      return "Select an office for each row.";
    if (customSelectedIds.length > MAX_CUSTOM)
      return `Maximum ${MAX_CUSTOM} offices.`;
    return null;
  };

  const handleConfirm = () => {
    const err = validate();
    if (err) {
      setError(err);
      return;
    }
    onConfirm({
      routingMode,
      reviewOfficeId,
      customOfficeIds: customSelectedIds,
    });
  };

  const headerActions = (
    <>
      <button
        type="button"
        onClick={onClose}
        className="rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-surface-400 transition"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={handleConfirm}
        className="rounded-md bg-brand-500 hover:bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition"
      >
        Save
      </button>
    </>
  );

  return (
    <Modal
      open={open}
      title="Choose workflow"
      onClose={onClose}
      widthClassName="max-w-lg"
      headerActions={headerActions}
    >
      <div className="flex flex-col gap-4">
        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2">
          {(["default", "custom"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setRoutingMode(mode);
                setError(null);
                if (mode === "default") setCustomOfficeIds([0]);
              }}
              className={[
                choiceCardCls(routingMode === mode),
                "p-3.5"
              ].join(" ")}
            >
              <p
                className={`text-xs font-bold uppercase tracking-wide ${routingMode === mode ? "text-slate-900 dark:text-slate-50" : "text-slate-600 dark:text-slate-300"}`}
              >
                {mode === "default"
                  ? isQA
                    ? "Default QA Flow"
                    : "Default Office Flow"
                  : "Custom Flow"}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed font-medium">
                {mode === "default"
                  ? "Standard chain through VP and President"
                  : "You choose 1–5 offices in order"}
              </p>
            </button>
          ))}
        </div>

        {/* Default QA: reviewer office */}
        {routingMode === "default" && isQA && (
          <div>
            <p className={labelCls}>
              Reviewer office{" "}
              <span className="text-rose-500 normal-case">*</span>
            </p>
            <OfficeDropdown
              value={reviewOfficeId}
              hideLabel
              excludeOfficeIds={myOfficeId > 0 ? [myOfficeId] : []}
              onChange={(id) => {
                setReviewOfficeId(id);
                setError(null);
              }}
            />
            <p className={helperCls}>
              The first office that will review this document.
            </p>
          </div>
        )}

        {/* Custom: recipient list */}
        {routingMode === "custom" && (
          <div>
            <p className={labelCls}>
              Recipients <span className="text-rose-500 normal-case">*</span>
            </p>
            <div className="flex flex-col gap-2">
              {customOfficeIds.map((val, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-slate-400">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <OfficeDropdown
                      value={val > 0 ? val : null}
                      hideLabel
                      onChange={(id, name, code) => {
                        setCustomOfficeIds((prev) => {
                          const next = [...prev];
                          next[idx] = id ?? 0;
                          const seen = new Set<number>();
                          return next.map((v) => {
                            if (!v) return 0;
                            if (seen.has(v)) return 0;
                            seen.add(v);
                            return v;
                          });
                        });
                        setOfficeNameById((prev) => ({ ...prev, [id]: name }));
                        setOfficeCodeById((prev) => ({ ...prev, [id]: code }));
                        setError(null);
                      }}
                      excludeOfficeIds={[
                        ...customSelectedIds.filter((id) => id !== val),
                        ...(myOfficeId > 0 ? [myOfficeId] : []),
                      ]}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCustomOfficeIds((prev) => {
                        const next = prev.filter((_, i) => i !== idx);
                        return next.length ? next : [0];
                      })
                    }
                    className="shrink-0 h-8 w-8 flex items-center justify-center rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 text-slate-400 hover:text-rose-500 hover:border-rose-300 dark:hover:border-rose-700 dark:hover:text-rose-400 transition"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {customOfficeIds.length < MAX_CUSTOM && (
                <button
                  type="button"
                  onClick={() => setCustomOfficeIds((p) => [...p, 0])}
                  className="mt-1 rounded-md border border-dashed border-slate-200 dark:border-surface-400 py-2.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-400 transition"
                >
                  + Add recipient
                </button>
              )}
            </div>
          </div>
        )}

        {/* Chain preview — 3 phases */}
        {chain.length > 0 && (
          <div className="rounded-md border border-slate-200 dark:border-surface-400 bg-slate-50/20 dark:bg-surface-600/10 px-3.5 py-3.5 space-y-2.5">
            <div className="flex items-center gap-2 mb-1">
              <span className="h-px flex-1 bg-slate-100 dark:bg-surface-400/50"></span>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
                Flow Preview
              </p>
              <span className="h-px flex-1 bg-slate-100 dark:bg-surface-400/50"></span>
            </div>
            {[
              { label: "Review", nodes: chain.slice(0, reviewEndIndex(chain)) },
              {
                label: "Approval",
                nodes: chain.slice(
                  reviewEndIndex(chain),
                  approvalEndIndex(chain),
                ),
              },
              {
                label: "Finalization",
                nodes: chain.slice(approvalEndIndex(chain)),
              },
            ].map((phase) => (
              <div key={phase.label} className="flex items-start gap-4">
                <span className="w-16 shrink-0 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider pt-1">
                  {phase.label}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {phase.nodes.map((node, i) => (
                    <React.Fragment key={i}>
                      <span
                        className={[
                          "rounded border px-2 py-0.5 text-xs font-medium transition-colors",
                          node.includes("✓")
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/20 dark:text-emerald-400"
                            : node === "Register" || node === "Distribute"
                              ? "border-slate-200 bg-slate-100 text-slate-600 dark:border-surface-400 dark:bg-surface-400 dark:text-slate-400"
                              : "border-slate-200 bg-white dark:border-surface-400 dark:bg-surface-500 text-slate-600 dark:text-slate-300",
                        ].join(" ")}
                      >
                        {node}
                      </span>
                      {i < phase.nodes.length - 1 && (
                        <span className="text-slate-300 dark:text-slate-600 font-light">
                          →
                        </span>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-md border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/15 px-4 py-3 text-xs font-medium text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
