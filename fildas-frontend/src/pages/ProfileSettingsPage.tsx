import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import PageFrame from "../components/layout/PageFrame";
import { useAuthUser } from "../hooks/useAuthUser";
import { 
  History, 
  Settings as SettingsIcon, 
  KeyRound, 
  Bell, 
  Volume2, 
  PenLine, 
  Wrench,
  Monitor,
  Layout,
  Sun,
  Moon,
  Laptop,
} from "lucide-react";
import { 
  listActivityLogs 
} from "../services/documents";
import { 
  updateProfile, 
  changePassword, 
  uploadProfilePhoto, 
  uploadSignature, 
  updateThemePreference,
  fetchProfile,
  type ProfileUpdatePayload 
} from "../services/profile";
import { ActivityTimeline, type ActivityLogRow } from "../components/profile/ActivityTimeline";
import { TwoFactorManager } from "../components/profile/TwoFactorManager";
import { ProfileInfoCard } from "../components/profile/ProfileInfoCard";
import { SessionManager } from "../components/profile/SessionManager";
import { Tabs } from "../components/ui/Tabs";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import SelectDropdown from "../components/ui/SelectDropdown";
import { inputCls } from "../utils/formStyles";
import { useToast } from "../components/ui/toast/ToastContext";
import { useThemeContext } from "../lib/ThemeContext";
import { useRefresh } from "../lib/RefreshContext";
import { normalizeError } from "../lib/normalizeError";
import { getUserRole, isAuditor } from "../lib/roleFilters";
import { PasswordRequirements, validatePassword } from "../components/auth/PasswordRequirements";

const ProfileSettingsPage: React.FC = () => {
  const user = useAuthUser();
  const { push } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("activity");

  // ── States ────────────────────────────────────────────────────────────────
  const [logs, setLogs] = useState<ActivityLogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Filters
  const [category, setCategory] = useState<string | number | null>("all");
  const [timeFilter, setTimeFilter] = useState<string | number | null>("all");
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [profileForm, setProfileForm] = useState<ProfileUpdatePayload>({
    first_name: "",
    middle_name: "",
    last_name: "",
    suffix: "",
    email: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Date Calculation ──────────────────────────────────────────────────────
  const getTimeParams = () => {
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    if (timeFilter === "yesterday") {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return { from: formatDate(d), to: formatDate(d) };
    }
    if (timeFilter === "week") {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { from: formatDate(d), to: formatDate(today) };
    }
    if (timeFilter === "month") {
      const d = new Date();
      d.setDate(1);
      return { from: formatDate(d), to: formatDate(today) };
    }
    return { from: undefined, to: undefined };
  };

  // ── Load Activity ────────────────────────────────────────────────────────
  const fetchLogs = async () => {
    if (activeTab !== "activity") return;
    setLogsLoading(true);
    const { from, to } = getTimeParams();
    try {
      const res = await listActivityLogs({ 
        scope: "mine", 
        per_page: 50,
        category: category === "all" ? undefined : (category as any),
        date_from: from,
        date_to: to
      });
      setLogs(res.data || []);
    } catch {
      push({ type: "error", title: "Error", message: "Failed to load activity log." });
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [activeTab, category, timeFilter]);

  const handleRefresh = async () => {
    try {
      // 1. Refresh Activity Logs
      await fetchLogs();
      
      // 2. Refresh User Profile Data
      const freshUser = await fetchProfile();
      localStorage.setItem("auth_user", JSON.stringify({ ...JSON.parse(localStorage.getItem("auth_user") || "{}"), ...freshUser }));
      window.dispatchEvent(new Event("auth_user_updated"));

      // 3. Trigger children refresh (Sessions)
      setRefreshTrigger(prev => prev + 1);

      return "Page data synchronized.";
    } catch (err) {
      push({ type: "error", title: "Refresh Failed", message: "Could not synchronize all page data." });
    } finally {
      // silent
    }
  };

  const { refreshKey } = useRefresh();
  const initialMountRef = Object.assign(React.useRef(true), {});

  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    handleRefresh();
  }, [refreshKey]);

  // ── Sync Profile Form ─────────────────────────────────────────────────────
  useEffect(() => {
    if (user) {
      setProfileForm({
        first_name: (user as any).first_name || "",
        middle_name: (user as any).middle_name || "",
        last_name: (user as any).last_name || "",
        suffix: (user as any).suffix || "",
        email: (user as any).email || "",
      });
    }
  }, [user]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const updated = await updateProfile(profileForm);
      localStorage.setItem("auth_user", JSON.stringify({ ...JSON.parse(localStorage.getItem("auth_user") || "{}"), ...updated }));
      window.dispatchEvent(new Event("auth_user_updated"));
      push({ type: "success", title: "Updated", message: "Profile information updated." });
      setIsEditModalOpen(false);
      setProfileForm(p => ({ ...p, current_password: "" })); // Clear password
    } catch (err) {
      push({ type: "error", title: "Update Failed", message: normalizeError(err) });
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const updated = await uploadProfilePhoto(file);
      localStorage.setItem("auth_user", JSON.stringify({ ...JSON.parse(localStorage.getItem("auth_user") || "{}"), ...updated }));
      window.dispatchEvent(new Event("auth_user_updated"));
      push({ type: "success", title: "Photo Updated", message: "Your profile photo has been updated." });
    } catch (err) {
      push({ type: "error", title: "Upload Failed", message: normalizeError(err) });
    }
  };

  const tabs = [
    { key: "activity", label: "My Activity", icon: <History className="h-4 w-4" /> },
    { key: "sessions", label: "Sessions", icon: <Laptop className="h-4 w-4" /> },
    { key: "settings", label: "Account Settings", icon: <SettingsIcon className="h-4 w-4" /> },
  ];

  const categories = [
    { value: "all", label: "All Activity" },
    { value: "workflow", label: "Workflows" },
    { value: "request", label: "Requests" },
    { value: "document", label: "Documents" },
    { value: "profile", label: "Profile" }
  ];

  const timeOptions = [
    { value: "all", label: "All Time" },
    { value: "yesterday", label: "Yesterday" },
    { value: "week", label: "This Week" },
    { value: "month", label: "This Month" }
  ];

  const isEmailChanged = user && profileForm.email !== (user as any).email;

  return (
    <PageFrame
      title="Profile & Settings"
      fullHeight
      onBack={() => navigate(-1)}
      right={null}
      contentClassName="flex flex-col min-h-0 h-full overflow-hidden bg-slate-50/50 dark:bg-black/10"
    >
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 h-full max-h-full min-h-0 p-4 md:p-6 overflow-hidden">
        
        {/* Left Side: Profile Card (Detached) */}
        <aside className="md:col-span-4 lg:col-span-3 h-full min-h-0">
          <ProfileInfoCard 
            user={user} 
            onEdit={() => setIsEditModalOpen(true)}
            onPhotoClick={() => document.getElementById("profile-photo-upload")?.click()}
          />
          <input 
            id="profile-photo-upload" 
            type="file" 
            accept="image/*" 
            className="hidden" 
            onChange={handlePhotoUpload} 
          />
        </aside>

        {/* Right Side: Shared Content Area */}
        <main className="md:col-span-8 lg:col-span-9 flex flex-col min-w-0 h-full min-h-0">
           {/* Content Card with Integrated Header */}
           <div className="flex-1 flex flex-col min-h-0 rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-sm overflow-hidden">
             
             {/* Card Header (Integrated Tabs + Filters) */}
             <div className="px-6 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-surface-400">
                <div className="-mb-px">
                   <Tabs
                      id="profile-tabs"
                      tabs={tabs}
                      activeTab={activeTab}
                      onChange={setActiveTab}
                      className="border-none bg-transparent"
                    />
                </div>

                {activeTab === "activity" && (
                   <div className="flex flex-col sm:flex-row items-center gap-4">
                      {/* Activity Category Dropdown */}
                      <SelectDropdown 
                        value={category}
                        onChange={setCategory}
                        options={categories}
                        placeholder="All Activity"
                        className="w-full sm:w-48"
                        clearable={false}
                      />

                      {/* Time Period Filter */}
                      <SelectDropdown 
                        value={timeFilter}
                        onChange={setTimeFilter}
                        options={timeOptions}
                        placeholder="All Time"
                        className="w-full sm:w-48"
                        clearable={false}
                      />
                   </div>
                )}
             </div>

              <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0 custom-scrollbar">
                {activeTab === "activity" ? (
                   <div className="max-w-4xl mx-auto py-6 px-4">
                      <ActivityTimeline items={logs} loading={logsLoading} />
                   </div>
                ) : activeTab === "settings" ? (
                   <div className="max-w-4xl mx-auto py-6 px-4 space-y-10">
                      <SettingsLayout user={user} push={push} />
                   </div>
                ) : (
                   <div className="max-w-4xl mx-auto py-6 px-4">
                      <SessionManager refreshTrigger={refreshTrigger} />
                   </div>
                )}
              </div>
           </div>
        </main>
      </div>

      <Modal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Personal Information"
        widthClassName="max-w-xl"
        footer={
          <div className="flex justify-end gap-3">
             <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
             <Button loading={savingProfile} onClick={handleProfileSubmit}>Save Changes</Button>
          </div>
        }
      >
        <form onSubmit={handleProfileSubmit} className="space-y-4">
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                 <label className="text-xs font-bold uppercase tracking-wider text-slate-400">First Name</label>
                 <input className={inputCls} value={profileForm.first_name} onChange={e => setProfileForm(p => ({ ...p, first_name: e.target.value }))} required />
              </div>
              <div className="space-y-1.5">
                 <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Last Name</label>
                 <input className={inputCls} value={profileForm.last_name} onChange={e => setProfileForm(p => ({ ...p, last_name: e.target.value }))} required />
              </div>
           </div>
           <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                 <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Middle Name</label>
                 <input className={inputCls} value={profileForm.middle_name || ""} onChange={e => setProfileForm(p => ({ ...p, middle_name: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                 <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Suffix</label>
                 <input className={inputCls} placeholder="Jr., III, etc." value={profileForm.suffix || ""} onChange={e => setProfileForm(p => ({ ...p, suffix: e.target.value }))} />
              </div>
           </div>
           <div className="space-y-1.5 pt-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Email Address</label>
              <input type="email" className={inputCls} value={profileForm.email} onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))} required />
           </div>

           {isEmailChanged && (
             <div className="p-4 rounded-md border border-rose-100 bg-rose-50/50 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
               <div className="flex items-center gap-2 text-rose-600">
                 <KeyRound className="h-4 w-4" />
                 <span className="text-xs font-bold uppercase tracking-wider">Security Verification</span>
               </div>
               <p className="text-[11px] text-rose-500 leading-tight">
                 You are changing your primary email address. To authorize this sensitive action, please enter your current password.
               </p>
               <input 
                 type="password" 
                 className={`${inputCls} bg-white dark:bg-surface-500 border-rose-200 focus:border-rose-400 focus:ring-rose-400/20`}
                 placeholder="Enter current password" 
                 value={profileForm.current_password || ""} 
                 onChange={e => setProfileForm(p => ({ ...p, current_password: e.target.value }))}
                 required={isEmailChanged}
               />
             </div>
           )}
        </form>
      </Modal>
    </PageFrame>
  );
};

// ── Internal Settings Sections ─────────────────────────────────────────────

const SettingsLayout: React.FC<{ user: any; push: any }> = ({ user, push }) => {
  const { theme: currentTheme, setTheme } = useThemeContext();
  const [pw, setPw] = useState({ current_password: "", password: "", password_confirmation: "" });
  const [pwLoading, setPwLoading] = useState(false);
  const sigInputRef = useRef<HTMLInputElement>(null);
  const [sigUrl, setSigUrl] = useState(user?.signature_url);

  // Notifications
  const [prefs, setPrefs] = useState({
    sound_notif: localStorage.getItem(`pref_sound_notif_${user?.id}`) !== "false"
  });

  const handleToggle = (key: string, val: boolean) => {
    if (key === "sound_notif") {
      setPrefs(p => ({ ...p, [key]: val }));
      localStorage.setItem(`pref_sound_notif_${user?.id}`, String(val));
      return;
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePassword(pw.password)) {
      return push({ 
        type: "error", 
        title: "Weak Password", 
        message: "Please meet all complexity requirements: 8+ characters, uppercase, numbers, and symbols." 
      });
    }
    if (pw.password !== pw.password_confirmation) return push({ type: "error", message: "Passwords do not match." });
    setPwLoading(true);
    try {
      await changePassword(pw);
      push({ type: "success", title: "Success", message: "Password updated." });
      setPw({ current_password: "", password: "", password_confirmation: "" });
    } catch (err) {
      push({ type: "error", message: normalizeError(err) });
    } finally {
      setPwLoading(false);
    }
  };

  const handleSigUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const updated = await uploadSignature(file);
      setSigUrl(updated.signature_url);
      push({ type: "success", message: "Signature updated." });
    } catch (err) { push({ type: "error", message: normalizeError(err) }); }
  };

  const handleThemeChange = async (theme: "light" | "dark" | "system") => {
    try {
      setTheme(theme);
      const updated = await updateThemePreference(theme);
      localStorage.setItem("auth_user", JSON.stringify({ ...JSON.parse(localStorage.getItem("auth_user") || "{}"), ...updated }));
    } catch {
      push({ type: "error", title: "Sync Failed", message: "Failed to save theme preference to your account." });
    }
  };

  const isAdmin = ["ADMIN", "SYSADMIN"].includes(String(getUserRole()).toUpperCase());

  return (
    <div className="space-y-12 pb-10">
      {isAdmin && (
        <div className="space-y-8 p-6 rounded-xl border border-brand-100 dark:border-brand-900/40 bg-brand-50/20 dark:bg-brand-500/5 shadow-sm animate-in fade-in slide-in-from-top-4 duration-500">
          <PillarHeader title="Developer & Administrative Tools" />
          <Section 
            title="Developer Debug Mode" 
            icon={<Wrench className="h-4 w-4" />} 
            description="Toggle advanced permissions and testing tools. When enabled, you can act on behalf of any office to test workflow logic."
          >
            <div className="divide-y divide-slate-100 dark:divide-surface-400 border border-brand-200/50 dark:border-surface-400 rounded-md bg-white dark:bg-surface-500 overflow-hidden shadow-sm">
              <ToggleRow 
                label="Enable Debug Mode" 
                desc="Bypass role/office restrictions for testing purposes." 
                checked={localStorage.getItem(`pref_debug_mode_${user?.id}`) === "1"} 
                onChange={v => {
                  localStorage.setItem(`pref_debug_mode_${user?.id}`, v ? "1" : "0");
                  window.dispatchEvent(new CustomEvent("admin_debug_mode_changed"));
                  push({ type: "success", title: "Debug Mode", message: v ? "Enabled" : "Disabled" });
                }} 
              />
            </div>
          </Section>
        </div>
      )}

      {/* ── Pillar 1: Configuration & Appearance ───────────────────────────── */}
      <div className="space-y-8">
        <PillarHeader title="Interface & Configuration" />
        
        {/* Theme section */}
        <Section 
          title="Default Theme" 
          icon={<Layout className="h-4 w-4" />} 
          description="Choose your account's default appearance. This will be applied regardless of which device you use."
        >
          <div className="flex p-1 bg-slate-100 dark:bg-surface-400 rounded-lg max-w-sm">
              {[
                { id: "light", label: "Light", icon: <Sun className="h-3.5 w-3.5" /> },
                { id: "dark", label: "Dark", icon: <Moon className="h-3.5 w-3.5" /> },
                { id: "system", label: "System", icon: <Monitor className="h-3.5 w-3.5" /> }
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleThemeChange(opt.id as any)}
                  className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-xs font-bold transition-all ${
                    currentTheme === opt.id 
                      ? "bg-white dark:bg-surface-600 text-brand-500 shadow-sm" 
                      : "text-slate-500 hover:text-slate-700 dark:text-slate-100"
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
          </div>
        </Section>

        {/* Notifications section */}
        <Section 
          title="Notifications & Sound" 
          icon={<Bell className="h-4 w-4" />} 
          description="System-critical emails (Action Required, Document Updates) are mandatory to ensure workflow accountability."
        >
            <div className="divide-y divide-slate-100 dark:divide-surface-400 border border-slate-100 dark:border-surface-400 rounded-md bg-white dark:bg-surface-500 overflow-hidden shadow-sm">
               <ToggleRow label="In-App Notification Sound" desc="Play a subtle chime when new notifications arrive." icon={<Volume2 className="h-3.5 w-3.5" />} checked={prefs.sound_notif} onChange={v => handleToggle("sound_notif", v)} />
            </div>
        </Section>
      </div>

      <div className="border-t border-slate-100 dark:border-surface-400" />

      {/* ── Pillar 2: Security & Identity ─────────────────────────────────── */}
      <div className="space-y-8">
        <PillarHeader title="Security & Access" />
        
        {/* Password section */}
        <Section title="Authentication" icon={<KeyRound className="h-4 w-4" />} description="Protect your account by using a strong password and multi-factor verification.">
          <div className="space-y-8">
              <TwoFactorManager user={user} />
              
              <div className="pt-4 border-t border-slate-100 dark:border-surface-400">
                <h5 className="text-[12px] font-bold uppercase tracking-wider text-slate-400 mb-4">Change Password</h5>
                <form onSubmit={handlePasswordSubmit} className="space-y-5">
                    <div className="space-y-1.5 max-w-sm">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Current Password</label>
                      <input type="password" className={inputCls} value={pw.current_password} onChange={e => setPw(p => ({ ...p, current_password: e.target.value }))} required />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">New Password</label>
                          <input type="password" className={inputCls} value={pw.password} onChange={e => setPw(p => ({ ...p, password: e.target.value }))} required />
                      </div>
                      <div className="space-y-1.5">
                          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Confirm New Password</label>
                          <input type="password" className={inputCls} value={pw.password_confirmation} onChange={e => setPw(p => ({ ...p, password_confirmation: e.target.value }))} required />
                      </div>
                    </div>
                    
                    {pw.password && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                        <PasswordRequirements password={pw.password} />
                      </div>
                    )}

                    <div className="flex justify-start">
                      <Button loading={pwLoading} size="sm" className="font-bold">Update Password</Button>
                    </div>
                </form>
              </div>
          </div>
        </Section>
      </div>

      <div className="border-t border-slate-100 dark:border-surface-400" />

      {/* ── Pillar 3: Identification & Misc ────────────────────────────────── */}
      <div className="space-y-8">
        <PillarHeader title="Identity & Personalization" />

        {/* Signature section */}
        {!isAuditor(getUserRole()) && (
          <Section title="E-Signature" icon={<PenLine className="h-4 w-4" />} description="Use your uploaded signature to sign documents and evidence requests.">
            <div className="flex flex-col sm:flex-row items-center gap-6 p-5 rounded-md border border-slate-100 dark:border-surface-400 bg-slate-50/50 dark:bg-surface-600/50">
                <div className="h-24 w-52 border border-dashed border-slate-300 dark:border-surface-400 rounded-md flex items-center justify-center bg-white dark:bg-surface-600 shadow-inner overflow-hidden">
                    {sigUrl ? <img src={sigUrl} className="max-h-full object-contain p-2" alt="Sig" /> : <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest opacity-50">No Signature</p>}
                </div>
                <div className="flex flex-col gap-3">
                    <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs">Supported formats: PNG, JPG (transparent recommended). Max size 1MB.</p>
                    <div className="flex items-center gap-3">
                        <Button variant="outline" size="sm" onClick={() => sigInputRef.current?.click()} className="font-bold text-[11px]">Upload New Signature</Button>
                        <input ref={sigInputRef} type="file" className="hidden" accept="image/*" onChange={handleSigUpload} />
                    </div>
                </div>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
};

const PillarHeader: React.FC<{ title: string }> = ({ title }) => (
  <div className="flex items-center gap-4">
    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400/80 shrink-0">
      {title}
    </h3>
    <div className="h-px flex-1 bg-slate-100 dark:bg-surface-400/50" />
  </div>
);

const Section: React.FC<{ icon: any; title: string; description: string; children: any }> = ({ icon, title, description, children }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-3">
       <div className="h-8 w-8 rounded bg-slate-100 dark:bg-surface-400 flex items-center justify-center text-slate-500">
          {icon}
       </div>
       <div>
          <h4 className="text-[14.5px] font-bold text-slate-800 dark:text-slate-100">{title}</h4>
          <p className="text-[12px] text-slate-500 dark:text-slate-400">{description}</p>
       </div>
    </div>
    <div className="pl-11">
      {children}
    </div>
  </div>
);

const ToggleRow: React.FC<{ label: string; desc: string; checked: boolean; onChange: (v: boolean) => void; icon?: any }> = ({ label, desc, checked, onChange, icon }) => (
  <div className="flex items-center justify-between p-4 px-5 group">
     <div className="flex items-center gap-3">
        {icon && <div className="text-slate-400 group-hover:text-brand-500 transition-colors">{icon}</div>}
        <div>
           <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{label}</p>
           <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
        </div>
     </div>
     <button 
        onClick={() => onChange(!checked)}
        className={`w-9 h-5 rounded-full transition-colors relative ${checked ? "bg-brand-500" : "bg-slate-200 dark:bg-surface-300"}`}
      >
        <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-white transition-all ${checked ? "translate-x-4" : ""}`} />
     </button>
  </div>
);

export default ProfileSettingsPage;
