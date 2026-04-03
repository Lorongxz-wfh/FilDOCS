import React, { useEffect, useMemo, useState } from "react";
import Modal from "../ui/Modal";
import Alert from "../ui/Alert";
import Button from "../ui/Button";
import InlineSpinner from "../ui/loader/InlineSpinner";
import SelectDropdown from "../ui/SelectDropdown";
import {
  createAdminUser,
  deleteAdminUser,
  disableAdminUser,
  enableAdminUser,
  getAdminOffices,
  getAdminRoles,
  getAdminUsers,
  uploadAdminUserPhoto,
  removeAdminUserPhoto,
  type AdminOffice,
  type AdminRole,
  type AdminUser,
  updateAdminUser,
} from "../../services/admin";

import { inputCls, labelCls } from "../../utils/formStyles";

const apiMsg = (e: any, fallback: string) =>
  e?.response?.data?.message ?? e?.message ?? fallback;
import { getAuthUser, AUTH_USER_KEY } from "../../lib/auth";
import { User as UserIcon } from "lucide-react";

type Props = {
  open: boolean;
  mode: "edit" | "create";
  user: AdminUser | null;
  onClose: () => void;
  onSaved?: (saved: AdminUser) => void;
};

const UserEditModal: React.FC<Props> = ({ open, mode, user, onClose, onSaved }) => {
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [offices, setOffices] = useState<AdminOffice[]>([]);
  const [loadingOffices, setLoadingOffices] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [occupiedOfficeIds, setOccupiedOfficeIds] = useState<{
    office_head: number[];
    vp: number[];
  }>({ office_head: [], vp: [] });
  const [presidentExists, setPresidentExists] = useState(false);
  const [acting, setActing] = useState<null | "disable" | "enable" | "delete">(
    null,
  );
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [suffix, setSuffix] = useState("");
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<number | null>(null);
  const [officeId, setOfficeId] = useState<number | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    // Don't reset photoPreview here — photo uploads manage it independently

    if (mode === "create") {
      setFirstName("");
      setMiddleName("");
      setLastName("");
      setSuffix("");
      setEmail("");
      setRoleId(null);
      setOfficeId(null);
      setPendingPhotoFile(null);
      return;
    }

    setFirstName(user?.first_name ?? "");
    setMiddleName(user?.middle_name ?? "");
    setLastName(user?.last_name ?? "");
    setSuffix(user?.suffix ?? "");
    setEmail(user?.email ?? "");
    setRoleId(user?.role_id ?? null);
    setOfficeId(user?.office_id ?? null);
  }, [open, user, mode]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        setLoadingRoles(true);
        const data = await getAdminRoles();
        if (alive) setRoles(data);
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Failed to load roles");
      } finally {
        if (alive) setLoadingRoles(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        setLoadingOffices(true);
        const res = await getAdminOffices({ per_page: 500 });
        if (alive) setOffices(res.data);
      } catch {
        // non-fatal
      } finally {
        if (alive) setLoadingOffices(false);
      }
    })();
    return () => { alive = false; };
  }, [open]);

  // Fetch active role holders to enforce uniqueness in the UI
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      try {
        const res = await getAdminUsers({ status: "active", per_page: 100 });
        if (!alive) return;
        const excludeId = mode === "edit" ? user?.id : undefined;
        const active = res.data;

        setOccupiedOfficeIds({
          office_head: active
            .filter(
              (u) =>
                u.role?.name?.toLowerCase() === "office_head" &&
                u.office_id != null &&
                u.id !== excludeId,
            )
            .map((u) => u.office_id as number),
          vp: active
            .filter(
              (u) =>
                u.role?.name?.toLowerCase() === "vp" &&
                u.office_id != null &&
                u.id !== excludeId,
            )
            .map((u) => u.office_id as number),
        });

        setPresidentExists(
          active.some(
            (u) =>
              u.role?.name?.toLowerCase() === "president" && u.id !== excludeId,
          ),
        );
      } catch {
        // non-fatal — just don't restrict
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, mode, user?.id]);

  const selectedRoleName = useMemo(() => {
    if (!roleId) return null;
    return roles.find((r) => r.id === roleId)?.name?.toLowerCase() ?? null;
  }, [roleId, roles]);

  const roleDisablesOffice =
    selectedRoleName === "admin" ||
    selectedRoleName === "sysadmin" ||
    selectedRoleName === "auditor";

  useEffect(() => {
    if (!open || !roleDisablesOffice) return;
    setOfficeId(null);
  }, [open, roleDisablesOffice]);

  const canSave = useMemo(() => {
    if (mode === "edit" && !user) return false;
    if (mode === "edit" && user?.deleted_at) return false;
    if (!firstName.trim() || !lastName.trim() || !email.trim()) return false;
    return true;
  }, [mode, user, firstName, lastName, email]);

  const syncIfSelf = (updated: AdminUser) => {
    const current = getAuthUser();
    if (current && current.id === updated.id) {
      const stored = localStorage.getItem(AUTH_USER_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem(AUTH_USER_KEY, JSON.stringify({ ...parsed, ...updated }));
        window.dispatchEvent(new Event("auth_user_updated"));
      }
    }
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);

    try {
      setUploadingPhoto(true);
      setError(null);
      const res = await uploadAdminUserPhoto(user.id, file);
      // Use the returned URL directly so preview stays accurate
      setPhotoPreview(res.user.profile_photo_url ?? null);
      syncIfSelf(res.user);
      onSaved?.(res.user);
    } catch (e: any) {
      setError(e?.message ?? "Failed to upload photo");
      setPhotoPreview(null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!user) return;
    try {
      setUploadingPhoto(true);
      setError(null);
      const res = await removeAdminUserPhoto(user.id);
      setPhotoPreview(null);
      syncIfSelf(res.user);
      onSaved?.(res.user);
    } catch (e: any) {
      setError(e?.message ?? "Failed to remove photo");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDisable = async () => {
    if (!user || !confirm(`Disable ${user.full_name}?`)) return;
    try {
      setActing("disable");
      setError(null);
      const res = await disableAdminUser(user.id);
      onSaved?.(res.user);
      onClose();
    } catch (e: any) {
      setError(apiMsg(e, "Failed to disable user"));
    } finally {
      setActing(null);
    }
  };

  const handleEnable = async () => {
    if (!user || !confirm(`Enable ${user.full_name}?`)) return;
    try {
      setActing("enable");
      setError(null);
      const res = await enableAdminUser(user.id);
      onSaved?.(res.user);
      onClose();
    } catch (e: any) {
      setError(apiMsg(e, "Failed to enable user"));
    } finally {
      setActing(null);
    }
  };

  const handleDelete = async () => {
    if (!user) return;
    if (
      !confirm(
        `Soft delete ${user.full_name}?\n\nThis hides the account and blocks access.`,
      )
    )
      return;
    try {
      setActing("delete");
      setError(null);
      await deleteAdminUser(user.id);
      onSaved?.({ ...user, deleted_at: new Date().toISOString() });
      onClose();
    } catch (e: any) {
      setError(apiMsg(e, "Failed to delete user"));
    } finally {
      setActing(null);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      const effectiveOfficeId = roleDisablesOffice ? null : officeId;

      if (mode === "create") {
        const res = await createAdminUser({
          first_name: firstName.trim(),
          middle_name: middleName.trim() || null,
          last_name: lastName.trim(),
          suffix: suffix.trim() || null,
          email: email.trim(),
          role_id: roleId,
          office_id: effectiveOfficeId,
        });
        // Upload photo if one was selected
        let savedUser = res.user;
        if (pendingPhotoFile) {
          try {
            const photoRes = await uploadAdminUserPhoto(
              res.user.id,
              pendingPhotoFile,
            );
            savedUser = photoRes.user;
          } catch {
            // Non-fatal — user created, photo just didn't upload
          }
        }
        onSaved?.(savedUser);
        onClose();
        return;
      }

      if (!user) return;
      const res = await updateAdminUser(user.id, {
        first_name: firstName.trim() || null,
        middle_name: middleName.trim() || null,
        last_name: lastName.trim() || null,
        suffix: suffix.trim() || null,
        email: email.trim() || null,
        role_id: roleId,
        office_id: effectiveOfficeId,
      });
      syncIfSelf(res.user);
      onSaved?.(res.user);
      onClose();
    } catch (e: any) {
      if ((e as any)?.code === "ERR_CANCELED" || e?.message === "canceled") return;
      setError(apiMsg(e, mode === "create" ? "Failed to create user" : "Failed to update user"));
    } finally {
      setSaving(false);
    }
  };

  // Reset photo preview only when modal closes
  useEffect(() => {
    if (!open) {
      setPhotoPreview(null);
      setPendingPhotoFile(null);
    }
  }, [open]);

  const isDeleted = mode === "edit" && !!user?.deleted_at;
  const isDisabled = mode === "edit" && !!user?.disabled_at;
  const currentPhoto =
    photoPreview ?? user?.profile_photo_url ?? user?.profile_photo_path ?? null;

  return (
    <Modal
      open={open}
      title={mode === "create" ? "New User" : "Edit User"}
      onClose={() => {
        if (saving) return;
        onClose();
      }}
      widthClassName="max-w-xl"
    >
      {/* Avatar section — edit mode only */}
      {mode === "edit" && (
        <div className="mb-5 flex items-center gap-4">
          <div className="relative shrink-0 h-16 w-16">
            {currentPhoto ? (
              <img
                src={currentPhoto}
                alt={user?.full_name}
                className="h-16 w-16 rounded-full object-cover ring-2 ring-slate-200 dark:ring-surface-400"
              />
            ) : (
              <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-surface-400 ring-2 ring-slate-200 dark:ring-surface-300 flex items-center justify-center">
                <UserIcon className="h-8 w-8 text-slate-400 dark:text-slate-500" strokeWidth={2} />
              </div>
            )}
            {uploadingPhoto && (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                <InlineSpinner className="h-5 w-5 border-2 border-white" />
              </div>
            )}
          </div>

          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {user?.full_name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
              {user?.role?.name ?? "No role"}{" "}
              {user?.office ? `· ${user.office.name}` : ""}
            </p>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-300 dark:hover:bg-surface-400 transition-colors">
                {uploadingPhoto ? "Uploading…" : "Change photo"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                  disabled={uploadingPhoto || saving}
                />
              </label>
              {currentPhoto && (
                <button
                  type="button"
                  onClick={handleRemovePhoto}
                  disabled={uploadingPhoto || saving}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-50 dark:border-surface-400 dark:bg-surface-500 dark:hover:bg-rose-950/30 transition-colors disabled:opacity-50"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          {/* Status badge */}
          {isDeleted && (
            <span className="ml-auto inline-flex items-center rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-surface-400 dark:bg-surface-400 dark:text-slate-400">
              Deleted
            </span>
          )}
          {!isDeleted && isDisabled && (
            <span className="ml-auto inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-rose-600 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400">
              Disabled
            </span>
          )}
          {!isDeleted && !isDisabled && mode === "edit" && (
            <span className="ml-auto inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-sky-600 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-400">
              Active
            </span>
          )}
        </div>
      )}

      {error && (
        <Alert variant="danger" className="mb-4">
          {error}
        </Alert>
      )}

      {/* Avatar — create mode */}
      {mode === "create" && (
        <div className="mb-5 flex items-center gap-4">
          <div className="relative shrink-0 h-14 w-14">
            {photoPreview ? (
              <img
                src={photoPreview}
                alt="Preview"
                className="h-14 w-14 rounded-full object-cover ring-2 ring-slate-200 dark:ring-surface-400"
              />
            ) : (
              <div className="h-14 w-14 rounded-full bg-slate-100 dark:bg-surface-600 ring-2 ring-slate-200 dark:ring-surface-400 flex items-center justify-center">
                <UserIcon
                  className="h-7 w-7 text-slate-400 dark:text-slate-500"
                  strokeWidth={2}
                />
              </div>
            )}
          </div>
          <div>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Profile photo <span className="text-slate-400">(optional)</span>
            </p>
            <div className="flex items-center gap-2">
              <label className="cursor-pointer rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-surface-400 dark:bg-surface-500 dark:text-slate-300 dark:hover:bg-surface-400 transition-colors">
                Choose photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={saving}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setPendingPhotoFile(file);
                    const reader = new FileReader();
                    reader.onload = () =>
                      setPhotoPreview(reader.result as string);
                    reader.readAsDataURL(file);
                  }}
                />
              </label>
              {photoPreview && (
                <button
                  type="button"
                  onClick={() => {
                    setPhotoPreview(null);
                    setPendingPhotoFile(null);
                  }}
                  className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-500 hover:bg-rose-50 dark:border-surface-400 dark:bg-surface-500 dark:hover:bg-rose-950/30 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Name fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>
            First name <span className="text-rose-500">*</span>
          </label>
          <input
            className={inputCls}
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            disabled={saving || isDeleted}
          />
        </div>
        <div>
          <label className={labelCls}>Middle name</label>
          <input
            className={inputCls}
            value={middleName}
            onChange={(e) => setMiddleName(e.target.value)}
            disabled={saving || isDeleted}
          />
        </div>
        <div>
          <label className={labelCls}>
            Last name <span className="text-rose-500">*</span>
          </label>
          <input
            className={inputCls}
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            disabled={saving || isDeleted}
          />
        </div>
        <div>
          <label className={labelCls}>Suffix</label>
          <input
            className={inputCls}
            value={suffix}
            onChange={(e) => setSuffix(e.target.value)}
            disabled={saving || isDeleted}
            placeholder="Jr., III…"
          />
        </div>
      </div>

      {/* Email */}
      <div className="mt-3">
        <label className={labelCls}>
          Email <span className="text-rose-500">*</span>
        </label>
        <input
          type="email"
          className={inputCls}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={saving || isDeleted}
        />
      </div>

      {/* Password info — create only */}
      {mode === "create" && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-surface-600 rounded-md px-3 py-2 border border-slate-200 dark:border-surface-400">
          A temporary password will be generated and emailed to the user.
        </p>
      )}

      {/* Role + Office */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <SelectDropdown
          label="Role"
          value={roleId}
          onChange={(v) => setRoleId(v ? Number(v) : null)}
          loading={loadingRoles}
          disabled={saving || isDeleted}
          placeholder="No role"
          clearLabel="No role"
          options={roles.map((r) => {
            const rName = r.name.toLowerCase();
            let restricted = false;
            if (rName === "president" && presidentExists) restricted = true;
            if (rName === "office_head" && officeId != null && occupiedOfficeIds.office_head.includes(officeId)) restricted = true;
            if (rName === "vp" && officeId != null && occupiedOfficeIds.vp.includes(officeId)) restricted = true;
            return {
              value: r.id,
              label: r.label || r.name,
              disabled: restricted,
              disabledHint: restricted ? "(already assigned)" : undefined,
            };
          })}
        />
        <SelectDropdown
          label={roleDisablesOffice ? "Office (N/A)" : "Office"}
          value={officeId}
          onChange={(v) => setOfficeId(v ? Number(v) : null)}
          loading={loadingOffices}
          disabled={roleDisablesOffice || saving || isDeleted}
          placeholder="No office"
          clearLabel="No office"
          options={(() => {
            const excludeList =
              selectedRoleName === "office_head"
                ? occupiedOfficeIds.office_head
                : selectedRoleName === "vp"
                  ? occupiedOfficeIds.vp
                  : [];
            return offices.map((o) => ({
              value: o.id,
              label: o.name,
              sublabel: `(${o.code})`,
              disabled: excludeList.includes(o.id),
              disabledHint: excludeList.includes(o.id) ? "— occupied" : undefined,
            }));
          })()}
        />
      </div>

      {/* Footer */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-surface-400 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {mode === "edit" && user && !isDeleted && (
            <>
              {isDisabled ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleEnable}
                    disabled={saving || acting !== null}
                  >
                    {acting === "enable" ? "Enabling…" : "Enable"}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={handleDelete}
                    disabled={saving || acting !== null}
                  >
                    {acting === "delete" ? "Deleting…" : "Delete"}
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDisable}
                  disabled={saving || acting !== null}
                >
                  {acting === "disable" ? "Disabling…" : "Disable"}
                </Button>
              )}
            </>
          )}
          {isDeleted && (
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Deleted account — cannot be modified.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={saving || acting !== null}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!canSave || saving || acting !== null || isDeleted}
          >
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <InlineSpinner className="h-4 w-4 border-2" /> Saving…
              </span>
            ) : mode === "create" ? (
              "Create user"
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </div>
    </Modal>
  );
};;;

export default UserEditModal;
