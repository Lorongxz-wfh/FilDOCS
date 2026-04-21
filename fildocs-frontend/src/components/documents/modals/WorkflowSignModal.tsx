import React, { useEffect, useRef, useState } from "react";
import { PDFDocument } from "pdf-lib";
import * as pdfjsLib from "pdfjs-dist";
import Button from "../../ui/Button";
import { getDocumentPreviewLink } from "../../../services/documentApi";
import {
  applyInAppSignature,
  getOriginalFileBlobUrl,
} from "../../../services/documentApi";
import api from "../../../services/api";

// Configure pdfjs worker (Vite resolves this as a URL)
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).href;

interface WorkflowSignModalProps {
  open: boolean;
  onClose: () => void;
  documentVersionId: number;
  /** Display URL for the signature image. Omit if user will upload on-the-spot. */
  signatureUrl?: string;
  /** If true, fetches original pre-sign file instead of current preview */
  isEditMode?: boolean;
  /** Original filename of the document — used to name the signed PDF */
  originalFilename?: string | null;
  onSigned: () => void;
  /** Called the moment Apply is clicked and the modal closes — before upload completes */
  onSigningStart?: () => void;
  /** Called if the background signing job fails after the modal is closed */
  onSignError?: (msg: string) => void;
}

const WorkflowSignModal: React.FC<WorkflowSignModalProps> = ({
  open,
  onClose,
  documentVersionId,
  signatureUrl,
  isEditMode = false,
  originalFilename,
  onSigned,
  onSigningStart,
  onSignError,
}) => {
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);
  /** Raw PDF bytes to pass to pdf-lib — same source as iframeUrl */
  const pdfBytesRef = useRef<ArrayBuffer | null>(null);

  /** On-the-spot signature — set when user uploads a file inside the modal */
  const [localSigFile, setLocalSigFile] = useState<File | null>(null);
  const [localSigPreviewUrl, setLocalSigPreviewUrl] = useState<string | null>(null);
  const sigFileInputRef = useRef<HTMLInputElement>(null);

  const [pageCount, setPageCount] = useState(1);
  const [selectedPage, setSelectedPage] = useState(0);
  /** Set to a monotone counter whenever pdfBytesRef.current is freshly written */
  const [pdfBytesKey, setPdfBytesKey] = useState(0);
  /** Data URL of the rendered PDF page for the live placement preview */
  const [pageDataUrl, setPageDataUrl] = useState<string | null>(null);
  /** width/height ratio of the rendered page (default A4 portrait) */
  const [pageAspect, setPageAspect] = useState(0.7071);
  const [sigX, setSigX] = useState(50);
  const [sigY, setSigY] = useState(80);
  const [sigW, setSigW] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [sigAspect, setSigAspect] = useState(4);
  const [pageInput, setPageInput] = useState("1");

  /** The display URL for the signature preview — prefers local upload over saved profile sig */
  const activeSigUrl = localSigPreviewUrl ?? signatureUrl ?? null;
  const hasSig = !!activeSigUrl;

  // ── Load PDF for preview and signing ───────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setError(null);
    setLoadingPreview(true);
    pdfBytesRef.current = null;

    const load = async () => {
      try {
        if (isEditMode) {
          // Fetch original pre-sign file through authenticated API
          const blobUrl = await getOriginalFileBlobUrl(documentVersionId);
          // Also fetch as ArrayBuffer for pdf-lib
          const resp = await api.get(
            `/document-versions/${documentVersionId}/original-file`,
            { responseType: "arraybuffer" },
          );
          pdfBytesRef.current = resp.data as ArrayBuffer;
          setPdfBytesKey((k) => k + 1);
          setIframeUrl(blobUrl);
          // Try to determine page count
          try {
            const pdfDoc = await PDFDocument.load(resp.data as ArrayBuffer);
            setPageCount(pdfDoc.getPageCount());
          } catch { /* ignore */ }
        } else {
          const { url } = await getDocumentPreviewLink(documentVersionId);
          setIframeUrl(url);
          // 1. Pre-fetch bytes ONCE for both pdf-lib and pdf.js
          try {
            const resp = await fetch(url);
            if (!resp.ok) throw new Error("Failed to fetch PDF data.");
            const bytes = await resp.arrayBuffer();
            pdfBytesRef.current = bytes;
            setPdfBytesKey((k) => k + 1);
            
            // 2. Determine page count immediately using pdf-lib (fastest)
            const pdfDoc = await PDFDocument.load(bytes);
            const count = pdfDoc.getPageCount();
            setPageCount(count);
          } catch (err) {
             console.error("PDF pre-fetch/parse error:", err);
          }
        }
      } catch (e: any) {
        setError(e?.message ?? "Failed to load document.");
      } finally {
        setLoadingPreview(false);
      }
    };

    load();

    // Revoke blob URL on cleanup
    return () => {
      setIframeUrl((prev) => {
        if (prev?.startsWith("blob:")) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [open, documentVersionId, isEditMode]);

  // Reset controls on open
  useEffect(() => {
    if (open) {
      setSelectedPage(0);
      setSigX(50);
      setSigY(80);
      setSigW(25);
      setError(null);
      setPageDataUrl(null);
      setLocalSigFile(null);
      setPageInput("1");
      if (localSigPreviewUrl) {
        URL.revokeObjectURL(localSigPreviewUrl);
        setLocalSigPreviewUrl(null);
      }
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cached pdfjs document ─────────────────────────────────────────────
  // We keep the loaded PDFDocumentProxy in a ref so changing pages never
  // re-parses the PDF. pdfjs transfers the ArrayBuffer to its worker on the
  // first getDocument call (detaching it), so we copy the bytes first.
  const pdfjsDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);

  // Load pdfjs document whenever fresh bytes arrive
  useEffect(() => {
    if (!pdfBytesRef.current) return;
    let cancelled = false;

    const load = async () => {
      try {
        // .slice(0) copies the ArrayBuffer — pdfjs can transfer the copy
        // without detaching pdfBytesRef.current (needed by pdf-lib on Apply)
        const data = new Uint8Array(pdfBytesRef.current!.slice(0));
        const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
        if (!cancelled) {
          pdfjsDocRef.current = pdfDoc;
          setPageCount(pdfDoc.numPages);
          // Trigger page render via a synthetic selectedPage change
          renderPageRef.current?.(pdfDoc, 0);
        }
      } catch { /* non-fatal */ }
    };

    load();
    return () => { cancelled = true; };
  }, [pdfBytesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Render a single page from the cached doc
  const renderPageRef = useRef<((doc: pdfjsLib.PDFDocumentProxy, pageIndex: number) => Promise<void>) | null>(null);
  renderPageRef.current = async (doc: pdfjsLib.PDFDocumentProxy, pageIndex: number) => {
    try {
      const pageNum = Math.min(pageIndex + 1, doc.numPages);
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1 });
      const scale = 1400 / viewport.width;
      const scaledVp = page.getViewport({ scale });
      const canvas = document.createElement("canvas");
      canvas.width = scaledVp.width;
      canvas.height = scaledVp.height;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        await page.render({ canvasContext: ctx as any, viewport: scaledVp, canvas }).promise;
        setPageAspect(canvas.width / canvas.height);
        setPageDataUrl(canvas.toDataURL("image/jpeg", 0.85));
      }
    } catch { /* non-fatal */ }
  };

  // Re-render when selectedPage changes (doc already loaded)
  useEffect(() => {
    if (!pdfjsDocRef.current) return;
    renderPageRef.current?.(pdfjsDocRef.current, selectedPage);
    // Sync text input whenever index changes
    setPageInput((selectedPage + 1).toString());
  }, [selectedPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLocalSigChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (localSigPreviewUrl) URL.revokeObjectURL(localSigPreviewUrl);
    const url = URL.createObjectURL(file);
    setLocalSigFile(file);
    setLocalSigPreviewUrl(url);
    e.target.value = "";
  };

  if (!open) return null;

  const handleApply = () => {
    // Snapshot all state values before closing — React state won't be
    // accessible after the modal unmounts
    const snapshotBytes   = pdfBytesRef.current;
    const snapshotIframe  = iframeUrl;
    const snapshotSigFile = localSigFile;
    const snapshotX       = sigX;
    const snapshotY       = sigY;
    const snapshotW       = sigW;
    const snapshotPage    = selectedPage;
    void sigAspect; // aspect ratio baked into sigImage dimensions at draw time

    // Notify parent signing has started, then close
    onSigningStart?.();
    onClose();

    // Derive filename from original document name
    const baseName = (originalFilename ?? "document").replace(/\.[^.]+$/, "");
    const signedFilename = `${baseName}.pdf`;

    const run = async () => {
      try {
        // 1. Get PDF bytes
        let pdfBytes = snapshotBytes;
        if (!pdfBytes) {
          if (isEditMode) {
            const resp = await api.get(
              `/document-versions/${documentVersionId}/original-file`,
              { responseType: "arraybuffer" },
            );
            pdfBytes = resp.data as ArrayBuffer;
          } else {
            if (!snapshotIframe) throw new Error("Document not loaded yet.");
            pdfBytes = await fetch(snapshotIframe).then((r) => {
              if (!r.ok) throw new Error("Failed to fetch PDF.");
              return r.arrayBuffer();
            });
          }
        }

        // 2. Load with pdf-lib
        const pdfDoc = await PDFDocument.load(pdfBytes!);
        const pages = pdfDoc.getPages();

        // 3. Get signature bytes
        let sigBytes: ArrayBuffer;
        let contentType: string;

        if (snapshotSigFile) {
          sigBytes = await snapshotSigFile.arrayBuffer();
          contentType = snapshotSigFile.type;
        } else if (activeSigUrl?.startsWith("data:")) {
          // If the profile signature is a Data URI, fetch it directly to avoid API roundtrip
          const r = await fetch(activeSigUrl);
          sigBytes = await r.arrayBuffer();
          contentType = activeSigUrl.split(":")[1].split(";")[0];
        } else {
          // Fallback to API if it's a URL path
          const sigResp = await api.get("/profile/signature-file", {
            responseType: "arraybuffer",
          });
          sigBytes = sigResp.data as ArrayBuffer;
          contentType = sigResp.headers["content-type"] ?? "";
        }

        const sigImage =
          contentType.includes("jpeg") || contentType.includes("jpg")
            ? await pdfDoc.embedJpg(sigBytes)
            : await pdfDoc.embedPng(sigBytes);

        // 4. Draw on selected page
        const page = pages[Math.min(snapshotPage, pages.length - 1)];
        const { width: pageW, height: pageH } = page.getSize();
        const drawW = pageW * (snapshotW / 100);
        const drawH = drawW / (sigImage.width / sigImage.height);
        const drawX = pageW * (snapshotX / 100) - drawW / 2;
        // Center the signature vertically at sigY% (matching the preview's center-anchor)
        const drawY = pageH - pageH * (snapshotY / 100) - drawH / 2;

        page.drawImage(sigImage, {
          x: Math.max(0, drawX),
          y: Math.max(0, drawY),
          width: drawW,
          height: drawH,
        });

        // 5. Save → File (named after the original document)
        const savedBytes = await pdfDoc.save();
        const blob = new Blob([savedBytes.buffer as ArrayBuffer], { type: "application/pdf" });
        const file = new File([blob], signedFilename, { type: "application/pdf" });

        // 6. Upload
        await applyInAppSignature(documentVersionId, file, () => {});

        onSigned();
      } catch (e: any) {
        onSignError?.(e?.message ?? "Failed to apply signature.");
      }
    };

    void run();
  };

  const sigHeightPct = sigW / sigAspect;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4">
      <div
        className="flex w-full max-w-5xl flex-col rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-2xl overflow-hidden"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-surface-400 px-5 py-3.5">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {isEditMode ? "Edit signature placement" : "Sign document"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isEditMode
                ? "Re-position your signature on the original document, then click Apply."
                : "Position your signature using the controls, preview placement, then click Apply."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left — live placement preview (scrollable, full width) */}
          <div className="flex-1 border-r border-slate-200 dark:border-surface-400 bg-slate-100 dark:bg-surface-600 overflow-y-auto">
            <div className="p-5 pb-2">
              {loadingPreview && !pageDataUrl ? (
                <div className="flex h-40 items-center justify-center">
                  <span className="text-xs text-slate-400">Loading document…</span>
                </div>
              ) : (
                /* paddingTop trick: height = width × (1/aspect) */
                <div
                  className="relative w-full shadow-md rounded-sm overflow-hidden"
                  style={{ paddingTop: `${(1 / pageAspect) * 100}%` }}
                >
                  {pageDataUrl ? (
                    <img
                      src={pageDataUrl}
                      alt="Page"
                      className="absolute inset-0 h-full w-full"
                      draggable={false}
                    />
                  ) : (
                    <div className="absolute inset-0 bg-white" />
                  )}
                  {hasSig && (
                    <div
                      className="absolute overflow-hidden pointer-events-none"
                      style={{
                        left: `${sigX - sigW / 2}%`,
                        top: `${sigY - sigHeightPct / 2}%`,
                        width: `${sigW}%`,
                        height: `${sigHeightPct}%`,
                      }}
                    >
                      <img
                        src={activeSigUrl!}
                        alt="Signature"
                        className="h-full w-full object-contain"
                        draggable={false}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="sticky bottom-0 py-1.5 text-center text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100/80 dark:bg-surface-600/80 backdrop-blur-sm">
              Page {selectedPage + 1}{pageCount > 1 ? ` of ${pageCount}` : ""}
            </p>
          </div>

          {/* Right — controls */}
          <div className="flex w-72 shrink-0 flex-col gap-5 overflow-y-auto p-5">
            {/* Signature — upload or show saved */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Signature
                </p>
                <button
                  type="button"
                  onClick={() => sigFileInputRef.current?.click()}
                  className="text-[11px] font-medium text-brand-500 dark:text-brand-400 hover:underline"
                >
                  {hasSig ? "Use different" : "Upload image"}
                </button>
              </div>

              {hasSig ? (
                <div className="flex h-14 w-full items-center justify-center rounded-md border border-dashed border-slate-300 dark:border-surface-300 bg-slate-50 dark:bg-surface-600 overflow-hidden">
                  <img
                    src={activeSigUrl!}
                    alt="Signature"
                    className="max-h-full max-w-full object-contain"
                    onLoad={(e) => {
                      const img = e.currentTarget;
                      if (img.naturalHeight > 0) setSigAspect(img.naturalWidth / img.naturalHeight);
                    }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => sigFileInputRef.current?.click()}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 dark:border-surface-300 bg-slate-50 dark:bg-surface-600 text-xs text-slate-400 dark:text-slate-500 hover:border-brand-400 hover:text-brand-500 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  Upload signature image
                </button>
              )}

              {localSigFile && (
                <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
                  Using uploaded file — not saved to your profile.
                </p>
              )}

              <input
                ref={sigFileInputRef}
                type="file"
                accept="image/png,image/jpeg"
                className="hidden"
                onChange={handleLocalSigChange}
              />
            </div>

            {/* Page */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Page
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={pageInput}
                onChange={(e) => {
                  const val = e.target.value;
                  // Only allow digits or empty string
                  if (/^\d*$/.test(val)) {
                    setPageInput(val);
                    const num = parseInt(val, 10);
                    if (!isNaN(num) && num >= 1 && num <= pageCount) {
                      setSelectedPage(num - 1);
                    }
                  }
                }}
                onBlur={() => {
                  // Revert to current page if left blank or invalid
                  if (pageInput === "" || parseInt(pageInput, 10) < 1 || parseInt(pageInput, 10) > pageCount) {
                    setPageInput((selectedPage + 1).toString());
                  }
                }}
                className="w-full rounded-md border border-slate-300 dark:border-surface-400 bg-white dark:bg-surface-600 px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-brand-400 dark:focus:border-brand-300 transition"
              />
              {pageCount > 1 && (
                <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                  {pageCount} pages total
                </p>
              )}
            </div>

            {/* Horizontal */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Horizontal
                </label>
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {sigX}%
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={95}
                value={sigX}
                onChange={(e) => setSigX(Number(e.target.value))}
                className="w-full accent-brand-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Left</span>
                <span>Center</span>
                <span>Right</span>
              </div>
            </div>

            {/* Vertical */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Vertical
                </label>
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {sigY}%
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={95}
                value={sigY}
                onChange={(e) => setSigY(Number(e.target.value))}
                className="w-full accent-brand-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Top</span>
                <span>Middle</span>
                <span>Bottom</span>
              </div>
            </div>

            {/* Size */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Size
                </label>
                <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                  {sigW}%
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={60}
                value={sigW}
                onChange={(e) => setSigW(Number(e.target.value))}
                className="w-full accent-brand-500"
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Small</span>
                <span>Large</span>
              </div>
            </div>

            {error && (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-400">
                {error}
              </p>
            )}

            <div className="mt-auto pt-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="w-full"
                disabled={!iframeUrl || !hasSig}
                onClick={handleApply}
              >
                {isEditMode ? "Re-apply signature" : "Apply signature"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowSignModal;
