import React, { useEffect, useRef, useState } from "react";
import PageFrame from "../components/layout/PageFrame";
import { useAuthUser } from "../hooks/useAuthUser";
import {
  updateProfile,
  changePassword,
  uploadProfilePhoto,
  removeProfilePhoto,
  type ProfileUpdatePayload,
} from "../services/profile";
import { Camera, Trash2, KeyRound, User, Bell, Volume2 } from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────
import { inputCls } from "../utils/formStyles";

const Field: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {label}
    </label>
    {children}
    {hint && (
      <p className="text-[11px] text-slate-400 dark:text-slate-500">{hint}</p>
    )}
  </div>
);

const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ icon, title, subtitle, children }) => (
  <div className="rounded-xl border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 overflow-hidden">
    <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 dark:border-surface-400">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 dark:bg-surface-400 text-slate-500 dark:text-slate-300">
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>
      </div>
    </div>
    <div className="px-6 py-5">{children}</div>
  </div>
);

const SaveButton: React.FC<{
  loading: boolean;
  label?: string;
}> = ({ loading, label = "Save changes" }) => (
  <button
    type="submit"
    disabled={loading}
    className="rounded-lg bg-sky-500 hover:bg-sky-600 disabled:opacity-50 px-5 py-2 text-sm font-semibold text-white transition"
  >
    {loading ? "Saving…" : label}
  </button>
);

const StatusMsg: React.FC<{
  success?: string | null;
  error?: string | null;
}> = ({ success, error }) => {
  if (!success && !error) return null;
  return (
    <div
      className={`rounded-lg border px-4 py-2.5 text-xs font-medium ${
        success
          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
          : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
      }`}
    >
      {success ?? error}
    </div>
  );
};

// ── Toggle ─────────────────────────────────────────────────────────────────
const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}> = ({ checked, onChange, label, description }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <div>
      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
        {label}
      </p>
      {description && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {description}
        </p>
      )}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
        checked ? "bg-sky-500" : "bg-slate-200 dark:bg-surface-400"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  </div>
);

// ── Main ───────────────────────────────────────────────────────────────────
const SettingsPage: React.FC = () => {
  const user = useAuthUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Profile form ──────────────────────────────────────────────────────
  const [profile, setProfile] = useState<ProfileUpdatePayload>({
    first_name: "",
    middle_name: "",
    last_name: "",
    suffix: "",
    email: "",
  });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setProfile({
      first_name: (user as any).first_name ?? "",
      middle_name: (user as any).middle_name ?? "",
      last_name: (user as any).last_name ?? "",
      suffix: (user as any).suffix ?? "",
      email: (user as any).email ?? "",
    });
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);
    setProfileSuccess(null);
    setProfileError(null);
    try {
      const updated = await updateProfile(profile);
      // Update localStorage so navbar/sidebar reflects new name
      const stored = localStorage.getItem("auth_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem(
          "auth_user",
          JSON.stringify({ ...parsed, ...updated }),
        );
        window.dispatchEvent(new Event("auth_user_updated"));
      }
      setProfileSuccess("Profile updated successfully.");
    } catch (e: any) {
      setProfileError(e?.message ?? "Failed to update profile.");
    } finally {
      setProfileLoading(false);
    }
  };

  // ── Photo ─────────────────────────────────────────────────────────────
  const [photoLoading, setPhotoLoading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    setPhotoUrl((user as any)?.profile_photo_url ?? null);
  }, [user]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoLoading(true);
    setPhotoError(null);
    try {
      const updated = await uploadProfilePhoto(file);
      setPhotoUrl(updated.profile_photo_url ?? null);
      const stored = localStorage.getItem("auth_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem(
          "auth_user",
          JSON.stringify({ ...parsed, ...updated }),
        );
        window.dispatchEvent(new Event("auth_user_updated"));
      }
    } catch (e: any) {
      setPhotoError(e?.message ?? "Failed to upload photo.");
    } finally {
      setPhotoLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handlePhotoRemove = async () => {
    setPhotoLoading(true);
    setPhotoError(null);
    try {
      await removeProfilePhoto();
      setPhotoUrl(null);
      const stored = localStorage.getItem("auth_user");
      if (stored) {
        const parsed = JSON.parse(stored);
        localStorage.setItem(
          "auth_user",
          JSON.stringify({
            ...parsed,
            profile_photo_url: null,
            profile_photo_path: null,
          }),
        );
        window.dispatchEvent(new Event("auth_user_updated"));
      }
    } catch (e: any) {
      setPhotoError(e?.message ?? "Failed to remove photo.");
    } finally {
      setPhotoLoading(false);
    }
  };

  // ── Password ──────────────────────────────────────────────────────────
  const [pw, setPw] = useState({
    current_password: "",
    password: "",
    password_confirmation: "",
  });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.password !== pw.password_confirmation) {
      setPwError("New passwords do not match.");
      return;
    }
    setPwLoading(true);
    setPwSuccess(null);
    setPwError(null);
    try {
      await changePassword(pw);
      setPwSuccess("Password changed successfully.");
      setPw({ current_password: "", password: "", password_confirmation: "" });
    } catch (e: any) {
      setPwError(e?.message ?? "Failed to change password.");
    } finally {
      setPwLoading(false);
    }
  };

  // ── Notification prefs (localStorage, per-user) ───────────────────────
  const prefKey = (key: string) => `pref_${key}_${user?.id ?? "guest"}`;

  const [emailDocUpdates, setEmailDocUpdates] = useState(false);
  const [emailApprovals, setEmailApprovals] = useState(false);
  const [soundNotif, setSoundNotif] = useState(false);

  // Re-read prefs once user is resolved
  useEffect(() => {
    if (!user?.id) return;
    setEmailDocUpdates(
      localStorage.getItem(prefKey("email_doc_updates")) !== "false",
    );
    setEmailApprovals(
      localStorage.getItem(prefKey("email_approvals")) !== "false",
    );
    setSoundNotif(localStorage.getItem(prefKey("sound_notif")) !== "false");
  }, [user?.id]);

  const handleEmailDocUpdates = (v: boolean) => {
    setEmailDocUpdates(v);
    localStorage.setItem(prefKey("email_doc_updates"), String(v));
  };
  const handleEmailApprovals = (v: boolean) => {
    setEmailApprovals(v);
    localStorage.setItem(prefKey("email_approvals"), String(v));
  };
  const handleSoundNotif = (v: boolean) => {
    setSoundNotif(v);
    localStorage.setItem(prefKey("sound_notif"), String(v));
  };

  // ── Initials avatar ───────────────────────────────────────────────────
  const initials = (user?.full_name ?? "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p: string) => p[0]?.toUpperCase())
    .join("");

  return (
    <PageFrame title="Settings" contentClassName="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left col — account */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Profile info */}
          <SectionCard
            icon={<User className="h-4 w-4" />}
            title="Personal information"
            subtitle="Update your name and email address."
          >
            {/* Photo */}
            <div className="mb-6 flex items-center gap-4">
              <div className="relative">
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    alt="Profile"
                    className="h-16 w-16 rounded-full object-cover border-2 border-slate-200 dark:border-surface-400"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40 text-xl font-bold text-brand-600 dark:text-brand-300 border-2 border-slate-200 dark:border-surface-400">
                    {initials || "?"}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={photoLoading}
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-sky-500 hover:bg-sky-600 text-white shadow transition disabled:opacity-50"
                >
                  <Camera className="h-3 w-3" />
                </button>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {user?.full_name ?? ""}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
                  {(user as any)?.role ?? ""}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoLoading}
                    className="text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline disabled:opacity-50"
                  >
                    {photoLoading ? "Uploading…" : "Change photo"}
                  </button>
                  {photoUrl && (
                    <>
                      <span className="text-slate-300 dark:text-surface-400">
                        ·
                      </span>
                      <button
                        type="button"
                        onClick={handlePhotoRemove}
                        disabled={photoLoading}
                        className="text-xs font-medium text-rose-500 hover:underline disabled:opacity-50 flex items-center gap-1"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    </>
                  )}
                </div>
                {photoError && (
                  <p className="mt-1 text-[11px] text-rose-600 dark:text-rose-400">
                    {photoError}
                  </p>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
              />
            </div>

            <form
              onSubmit={handleProfileSubmit}
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <Field label="First name">
                  <input
                    className={inputCls}
                    value={profile.first_name}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, first_name: e.target.value }))
                    }
                    required
                  />
                </Field>
                <Field label="Last name">
                  <input
                    className={inputCls}
                    value={profile.last_name}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, last_name: e.target.value }))
                    }
                    required
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Middle name" hint="Optional">
                  <input
                    className={inputCls}
                    value={profile.middle_name ?? ""}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, middle_name: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Suffix" hint="e.g. Jr., III">
                  <input
                    className={inputCls}
                    value={profile.suffix ?? ""}
                    onChange={(e) =>
                      setProfile((p) => ({ ...p, suffix: e.target.value }))
                    }
                  />
                </Field>
              </div>
              <Field label="Email address">
                <input
                  type="email"
                  className={inputCls}
                  value={profile.email}
                  onChange={(e) =>
                    setProfile((p) => ({ ...p, email: e.target.value }))
                  }
                  required
                />
              </Field>
              <StatusMsg success={profileSuccess} error={profileError} />
              <div className="flex justify-end">
                <SaveButton loading={profileLoading} />
              </div>
            </form>
          </SectionCard>

          {/* Password */}
          <SectionCard
            icon={<KeyRound className="h-4 w-4" />}
            title="Change password"
            subtitle="Use a strong password of at least 8 characters."
          >
            <form
              onSubmit={handlePasswordSubmit}
              className="flex flex-col gap-4"
            >
              <Field label="Current password">
                <input
                  type="password"
                  className={inputCls}
                  value={pw.current_password}
                  onChange={(e) =>
                    setPw((p) => ({ ...p, current_password: e.target.value }))
                  }
                  required
                  autoComplete="current-password"
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="New password">
                  <input
                    type="password"
                    className={inputCls}
                    value={pw.password}
                    onChange={(e) =>
                      setPw((p) => ({ ...p, password: e.target.value }))
                    }
                    required
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="Confirm new password">
                  <input
                    type="password"
                    className={inputCls}
                    value={pw.password_confirmation}
                    onChange={(e) =>
                      setPw((p) => ({
                        ...p,
                        password_confirmation: e.target.value,
                      }))
                    }
                    required
                    autoComplete="new-password"
                  />
                </Field>
              </div>
              <StatusMsg success={pwSuccess} error={pwError} />
              <div className="flex justify-end">
                <SaveButton loading={pwLoading} label="Change password" />
              </div>
            </form>
          </SectionCard>
        </div>

        {/* Right col — notifications */}
        <div className="flex flex-col gap-6">
          <SectionCard
            icon={<Bell className="h-4 w-4" />}
            title="Email notifications"
            subtitle="Control which emails you receive."
          >
            <div className="divide-y divide-slate-100 dark:divide-surface-400">
              <Toggle
                checked={emailDocUpdates}
                onChange={handleEmailDocUpdates}
                label="Document updates"
                description="Get notified when a document is assigned to you or changes status."
              />
              <Toggle
                checked={emailApprovals}
                onChange={handleEmailApprovals}
                label="Approvals & reviews"
                description="Receive an email when action is required from you."
              />
            </div>
          </SectionCard>

          <SectionCard
            icon={<Volume2 className="h-4 w-4" />}
            title="Sound notifications"
            subtitle="Play a sound when new notifications arrive."
          >
            <div className="divide-y divide-slate-100 dark:divide-surface-400">
              <Toggle
                checked={soundNotif}
                onChange={handleSoundNotif}
                label="In-app sounds"
                description="Play a chime when a new notification appears."
              />
            </div>
          </SectionCard>
        </div>
      </div>
    </PageFrame>
  );
};

export default SettingsPage;
