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

/**
 * WorkflowHeaderPanel handles the actionable banners (Alerts) for the document flow.
 * The primary status and action buttons are synced to the parent layout, so we don't
 * render a redundant status row here per user feedback.
 */
const WorkflowHeaderPanel: React.FC<Props> = ({
  approverNeedsSignedUpload,
  approverHasDownloaded,
  isPreApprovalCreatorCheck,
  hasSignedFile,
  hasPreSignBackup,
  currentUserSignatureUrl,
  needsFileReplacement,
  
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
      {/* These only appear when the user specifically needs to perform a task like signing */}
      
      {approverNeedsSignedUpload && (
        <Alert
          alertStyle="accent"
          variant="warning"
          icon={<Upload className="h-4 w-4" />}
          title={`Step ${!approverHasDownloaded ? '1' : '2'}: ${!approverHasDownloaded ? 'Download the document for signing' : 'Upload your signed copy'}`}
          action={
            !approverHasDownloaded ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={onDownload}
                  disabled={isChangingStatus || signingInBackground}
                  className="!bg-amber-600 hover:!bg-amber-700 font-bold border-none"
                >
                  Download
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onTriggerSign(false)}
                  disabled={isChangingStatus || signingInBackground}
                  className="!border-amber-500 !text-amber-500 hover:!bg-amber-500/10 font-bold"
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
                className="!bg-amber-600 hover:!bg-amber-700 font-bold border-none"
                disabled={isUploading || isChangingStatus}
              >
                {isUploading ? "Uploading…" : "Upload signed"}
              </Button>
            )
          }
        >
          {!approverHasDownloaded
            ? "Download the document, sign it, then upload your signed copy to enable forwarding."
            : "Upload your signed copy to enable forwarding."}
        </Alert>
      )}

      {isPreApprovalCreatorCheck && !hasSignedFile && (
        <Alert
          alertStyle="accent"
          variant="info"
          icon={<Upload className="h-4 w-4" />}
          title="Upload signed document to start approval"
          action={
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={onTriggerUpload}
                disabled={isUploading || isChangingStatus}
              >
                {isUploading ? "Uploading…" : "Upload signed"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onTriggerSign(false)}
                disabled={isUploading || isChangingStatus || signingInBackground}
              >
                {signingInBackground && <Loader2 size={12} className="animate-spin mr-1" />}
                {signingInBackground ? "Signing…" : "Sign in-app"}
              </Button>
            </div>
          }
        >
          Download the reviewed document, sign it, then upload the signed copy before starting the approval phase.
        </Alert>
      )}

      {isPreApprovalCreatorCheck && hasSignedFile && (
        <Alert
          alertStyle="accent"
          variant="success"
          icon={<CheckCircle2 className="h-4 w-4" />}
          title="Signed document uploaded — ready for approval"
          action={
            hasPreSignBackup ? (
              <div className="flex items-center gap-2">
                {currentUserSignatureUrl && (
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => onTriggerSign(true)}
                    disabled={isChangingStatus || removingSignature}
                    className="!border-emerald-400 !text-emerald-700 font-medium"
                  >
                    Edit signature
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={isChangingStatus || removingSignature}
                  onClick={onRemoveSignature}
                  className="!border-rose-300 !text-rose-600 font-medium"
                >
                  {removingSignature ? "Removing…" : "Remove signature"}
                </Button>
              </div>
            ) : undefined
          }
        >
          A signed version is uploaded. You can now start the official approval phase.
        </Alert>
      )}

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
