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
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Alert
              dense
              variant="primary"
              icon={<FileSearch className="h-4 w-4" />}
              title="Drafting: No document attached"
              action={
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={onTriggerUpload}
                  disabled={isUploading || isChangingStatus || signingInBackground || removingSignature || !canAct}
                >
                  {isUploading ? "Uploading…" : "Upload document"}
                </Button>
              }
            >
              Attach a document to begin the workflow.
            </Alert>
          </motion.div>
        )}
        
        {canAct && approverNeedsSignedUpload && !approverHasUploaded && (
          <motion.div
            key="approver-sign"
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Alert
              dense
              variant="primary"
              icon={<Upload className="h-4 w-4" />}
              title={approverHasDownloaded ? "Step 2: Upload signed copy" : "Step 1: Download for signing"}
              action={
                <div className="flex items-center gap-2">
                  {!approverHasDownloaded ? (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
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
                    onClick={() => onTriggerSign(false)}
                    disabled={isUploading || isChangingStatus || signingInBackground || removingSignature || !canAct}
                  >
                    {signingInBackground && <Loader2 size={12} className="animate-spin mr-1" />}
                    {signingInBackground ? "Signing…" : "Sign in-app"}
                  </Button>
                </div>
              }
            >
              {!approverHasDownloaded
                ? "Choose a signing option to enable forwarding."
                : "Upload signed copy or sign directly in the app."}
            </Alert>
          </motion.div>
        )}

        {/* 2. QA Creator Signing Banner (Pre-Approval) */}
        {canAct && isPreApprovalCreatorCheck && !hasSignedFile && (
          <motion.div
            key="creator-sign"
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Alert
              dense
              variant="primary"
              icon={<Upload className="h-4 w-4" />}
              title="Sign document before approval"
              action={
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={onTriggerUpload}
                    disabled={isUploading || isChangingStatus || signingInBackground || removingSignature || !canAct}
                  >
                    {isUploading ? "Uploading…" : "Upload"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onTriggerSign(false)}
                    disabled={isUploading || isChangingStatus || signingInBackground || removingSignature || !canAct}
                  >
                    {signingInBackground && <Loader2 size={12} className="animate-spin mr-1" />}
                    {signingInBackground ? "Signing…" : "Sign in-app"}
                  </Button>
                </div>
              }
            >
              A signature is required from the document owner before approval.
            </Alert>
          </motion.div>
        )}

        {/* 3. Success Banner (Signed State - Persistent) */}
        {canAct && ((isPreApprovalCreatorCheck && hasSignedFile) || (isActiveApprover && approverHasUploaded)) && (
          <motion.div
            key="signed-success"
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Alert
              dense
              variant="success"
              icon={<CheckCircle2 className="h-4 w-4" />}
              title={isActiveApprover && !isPreApprovalCreatorCheck ? "Document signed" : "Draft signed & ready"}
              action={
                <div className="flex items-center gap-2">
                  {currentUserSignatureUrl && hasPreSignBackup && (
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
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
                    disabled={isChangingStatus || removingSignature || !canAct}
                    onClick={onRemoveSignature}
                  >
                    {removingSignature ? "Removing…" : "Remove"}
                  </Button>
                </div>
              }
            >
              Signature attached. You can now proceed.
            </Alert>
          </motion.div>
        )}

        {/* 4. Revision/Replacement Banner */}
        {needsFileReplacement && (
          <motion.div
            key="needs-replacement"
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            <Alert
              variant="warning"
              icon={<AlertTriangle className="h-4 w-4" />}
              title="Revised document required"
            >
              This document was returned for revision. Please use the "Replace file" button above to upload the corrected version before forwarding it for review again.
            </Alert>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default WorkflowHeaderPanel;
