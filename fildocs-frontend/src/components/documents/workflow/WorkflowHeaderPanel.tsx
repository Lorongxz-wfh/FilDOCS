import React from "react";
import { Upload, AlertTriangle, Loader2, CheckCircle2, FileSearch } from "lucide-react";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import type { HeaderActionButton } from "./config/types";

interface Props {
  documentCode: string;
  versionNumber: number;
  status: string;
  canAct: boolean;
  headerActions: HeaderActionButton[];
  
  // Alert states
  approverNeedsSignedUpload: boolean;
  approverHasDownloaded: boolean;
  isPreApprovalCreatorCheck: boolean;
  hasSignedFile: boolean;
  hasPreSignBackup: boolean;
  currentUserSignatureUrl: string | null;
  needsFileReplacement: boolean;
  isActiveApprover?: boolean;
  approverHasUploaded?: boolean;
  // Action states
  isDraft: boolean;
  hasFile: boolean;
  
  // Actions
  onDownload: () => Promise<void>;
  onTriggerSign: (editMode?: boolean) => void;
  onTriggerUpload: () => void;
  onRemoveSignature: () => Promise<void>;
  
  // Statuses
  isChangingStatus: boolean;
  isUploading: boolean;
  signingInBackground: boolean;
  removingSignature: boolean;
}

import { motion, AnimatePresence } from "framer-motion";

/**
 * WorkflowHeaderPanel handles the actionable banners (Alerts) for the document flow.
 */
const WorkflowHeaderPanel: React.FC<Props> = ({
  approverNeedsSignedUpload,
  approverHasDownloaded,
  isPreApprovalCreatorCheck,
  hasSignedFile,
  hasPreSignBackup,
  currentUserSignatureUrl,
  needsFileReplacement,
  isActiveApprover,
  approverHasUploaded,
  canAct,
  isDraft,
  hasFile,
  
  onDownload,
  onTriggerSign,
  onTriggerUpload,
  onRemoveSignature,
  
  isChangingStatus,
  isUploading,
  signingInBackground,
  removingSignature,
}) => {
  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {/* ───── Action-Required Banners ─────────────────────────────────────────── */}
        {/* 0. Drafting - No Document Attached Banner */}
        {isDraft && !hasFile && (
          <motion.div
            key="draft-no-file"
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
          >
            <Alert
              dense
              variant="primary"
              className="border-brand-200 dark:border-brand-900/50"
              icon={<FileSearch className="h-4 w-4" />}
              title={<span className="font-bold uppercase tracking-widest text-[10px]">Action Required: Upload Document</span>}
              action={
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  reveal
                  onClick={onTriggerUpload}
                  disabled={isUploading || isChangingStatus || signingInBackground || removingSignature || !canAct}
                >
                  {isUploading ? "Uploading…" : "Upload document"}
                </Button>
              }
            >
              <p className="text-xs font-medium text-brand-700/80 dark:text-brand-400/80">Attach a document to begin the workflow.</p>
            </Alert>
          </motion.div>
        )}
        
        {canAct && approverNeedsSignedUpload && !approverHasUploaded && (
          <motion.div
            key="approver-sign"
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
          >
            <Alert
              dense
              variant="primary"
              className="border-brand-200 dark:border-brand-900/50"
              icon={<Upload className="h-4 w-4" />}
              title={<span className="font-bold uppercase tracking-widest text-[10px]">{approverHasDownloaded ? "Step 2: Upload signed copy" : "Step 1: Download for signing"}</span>}
              action={
                <div className="flex items-center gap-2">
                  {!approverHasDownloaded ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      reveal
                      onClick={onDownload}
                      disabled={isUploading || isChangingStatus || signingInBackground || removingSignature || !canAct}
                    >
                      Download
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      reveal
                      onClick={onTriggerUpload}
                      disabled={isUploading || isChangingStatus || signingInBackground || removingSignature || !canAct}
                    >
                      {isUploading ? "Uploading…" : "Upload"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    reveal
                    onClick={() => onTriggerSign(false)}
                    disabled={isUploading || isChangingStatus || signingInBackground || removingSignature || !canAct}
                  >
                    {signingInBackground && <Loader2 size={12} className="animate-spin mr-1" />}
                    {signingInBackground ? "Signing…" : "Sign in-app"}
                  </Button>
                </div>
              }
            >
              <p className="text-xs font-medium text-brand-700/80 dark:text-brand-400/80">
                {!approverHasDownloaded
                  ? "Choose a signing option to enable forwarding."
                  : "Upload signed copy or sign directly in the app."}
              </p>
            </Alert>
          </motion.div>
        )}

        {/* 2. QA Creator Signing Banner (Pre-Approval) */}
        {canAct && isPreApprovalCreatorCheck && !hasSignedFile && (
          <motion.div
            key="creator-sign"
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
          >
            <Alert
              dense
              variant="primary"
              className="border-brand-200 dark:border-brand-900/50"
              icon={<Upload className="h-4 w-4" />}
              title={<span className="font-bold uppercase tracking-widest text-[10px]">Action Required: Sign document before approval</span>}
              action={
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    reveal
                    onClick={onTriggerUpload}
                    disabled={isUploading || isChangingStatus || signingInBackground || removingSignature || !canAct}
                  >
                    {isUploading ? "Uploading…" : "Upload"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    reveal
                    onClick={() => onTriggerSign(false)}
                    disabled={isUploading || isChangingStatus || signingInBackground || removingSignature || !canAct}
                  >
                    {signingInBackground && <Loader2 size={12} className="animate-spin mr-1" />}
                    {signingInBackground ? "Signing…" : "Sign in-app"}
                  </Button>
                </div>
              }
            >
              <p className="text-xs font-medium text-brand-700/80 dark:text-brand-400/80">A signature is required from the document owner before approval.</p>
            </Alert>
          </motion.div>
        )}

        {/* 3. Success Banner (Signed State - Persistent) */}
        {canAct && ((isPreApprovalCreatorCheck && hasSignedFile) || (isActiveApprover && approverHasUploaded)) && (
          <motion.div
            key="signed-success"
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
          >
            <Alert
              dense
              variant="success"
              className="border-emerald-200 dark:border-emerald-900/50"
              icon={<CheckCircle2 className="h-4 w-4" />}
              title={<span className="font-bold uppercase tracking-widest text-[10px]">{isActiveApprover && !isPreApprovalCreatorCheck ? "Document signed" : "Draft signed & ready"}</span>}
              action={
                <div className="flex items-center gap-2">
                  {currentUserSignatureUrl && hasPreSignBackup && (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      reveal
                      onClick={() => onTriggerSign(true)}
                      disabled={isChangingStatus || removingSignature || !canAct}
                    >
                      Edit
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="danger"
                    size="xs"
                    reveal
                    disabled={isChangingStatus || removingSignature || !canAct}
                    onClick={onRemoveSignature}
                  >
                    {removingSignature ? "Removing…" : "Remove"}
                  </Button>
                </div>
              }
            >
              <p className="text-xs font-medium text-emerald-700/80 dark:text-emerald-400/80">Signature attached. You can now proceed.</p>
            </Alert>
          </motion.div>
        )}

        {/* 4. Revision/Replacement Banner */}
        {needsFileReplacement && (
          <motion.div
            key="needs-replacement"
            initial={{ opacity: 0, height: 0, y: -10 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] as const }}
          >
            <Alert
              variant="warning"
              className="border-amber-200 dark:border-amber-900/50"
              icon={<AlertTriangle className="h-4 w-4" />}
              title={<span className="font-bold uppercase tracking-widest text-[10px]">Revised document required</span>}
            >
              <p className="text-xs font-medium text-amber-700/80 dark:text-amber-400/80">This document was returned for revision. Please use the "Replace file" button above to upload the corrected version before forwarding it for review again.</p>
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkflowHeaderPanel;
