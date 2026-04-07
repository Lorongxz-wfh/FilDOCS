import React from "react";
import { Upload, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import Alert from "../../ui/Alert";
import Button from "../../ui/Button";
import type { HeaderActionButton } from "./types";

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

import { FileSearch } from "lucide-react";

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
    <>
      {/* ───── Action-Required Banners ─────────────────────────────────────────── */}

      {/* 0. Drafting - No Document Attached Banner */}
      {isDraft && !hasFile && (
        <Alert
          variant="primary"
          icon={<FileSearch className="h-4 w-4" />}
          title="Drafting: No document attached"
          action={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={onTriggerUpload}
                disabled={isUploading || isChangingStatus || !canAct}
              >
                {isUploading ? "Uploading…" : "Upload document"}
              </Button>
            </div>
          }
        >
          This workflow is currently a draft. You must attach a document before you can forward it to the next office.
        </Alert>
      )}
      
      {/* 1. Approver Signing Banner (Uniform Orange) */}
      {approverNeedsSignedUpload && !hasSignedFile && (
        <Alert
          variant="warning"
          icon={<Upload className="h-4 w-4" />}
          title={approverHasDownloaded ? "Step 2: Upload signed copy" : "Step 1: Download for signing"}
          action={
            !approverHasDownloaded ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={onDownload}
                  disabled={isChangingStatus || signingInBackground || !canAct}
                >
                  Download
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onTriggerSign(false)}
                  disabled={isChangingStatus || signingInBackground || !canAct}
                >
                  {signingInBackground && <Loader2 size={12} className="animate-spin mr-1" />}
                  {signingInBackground ? "Signing…" : "Sign in-app"}
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={onTriggerUpload}
                disabled={isUploading || isChangingStatus}
              >
                {isUploading ? "Uploading…" : "Upload signed"}
              </Button>
            )
          }
        >
          {!approverHasDownloaded
            ? "Please choose one of the signing options below to enable forwarding."
            : "Upload your signed copy to enable forwarding."}
        </Alert>
      )}

      {/* 2. QA Creator Signing Banner (Pre-Approval) */}
      {isPreApprovalCreatorCheck && !hasSignedFile && (
        <Alert
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
                disabled={isUploading || isChangingStatus || !canAct}
              >
                {isUploading ? "Uploading…" : "Upload signed"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onTriggerSign(false)}
                disabled={isUploading || isChangingStatus || signingInBackground || !canAct}
              >
                {signingInBackground && <Loader2 size={12} className="animate-spin mr-1" />}
                {signingInBackground ? "Signing…" : "Sign in-app"}
              </Button>
            </div>
          }
        >
          You must sign the document before starting the formal approval phase.
        </Alert>
      )}

      {/* 3. Success Banner (Signed State - Persistent) */}
      {(isPreApprovalCreatorCheck || isActiveApprover) && hasSignedFile && (
        <Alert
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
                  Edit signature
                </Button>
              )}
              <Button
                type="button"
                variant="danger"
                size="xs"
                disabled={isChangingStatus || removingSignature || !canAct}
                onClick={onRemoveSignature}
                className="bg-red-600 hover:bg-red-700 border-red-600 text-white"
              >
                {removingSignature ? "Removing…" : "Remove signature"}
              </Button>
            </div>
          }
        >
          {isActiveApprover && !isPreApprovalCreatorCheck
            ? "You have uploaded your signed copy. You can now proceed with the approval action below."
            : "You have attached your signature. You can now proceed to forward this document for approval."}
        </Alert>
      )}

      {/* 4. Revision/Replacement Banner */}
      {needsFileReplacement && (
        <Alert
          variant="warning"
          icon={<AlertTriangle className="h-4 w-4" />}
          title="Revised document required"
        >
          This document was returned for revision. Please use the "Replace file" button above to upload the corrected version before forwarding it for review again.
        </Alert>
      )}
    </>
  );
};

export default WorkflowHeaderPanel;
