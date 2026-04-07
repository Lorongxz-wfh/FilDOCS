import React from "react";
import { User, Mail, Building2, ShieldCheck, Fingerprint, Camera } from "lucide-react";
import Button from "../ui/Button";

interface ProfileInfoCardProps {
  user: any;
  onEdit: () => void;
  onPhotoClick?: () => void;
  photoLoading?: boolean;
}

export const ProfileInfoCard: React.FC<ProfileInfoCardProps> = ({ 
  user, 
  onEdit, 
  onPhotoClick,
  photoLoading 
}) => {
  const photoUrl = user?.profile_photo_url;

  return (
    <div className="h-full rounded-md border border-slate-200 dark:border-surface-400 bg-white dark:bg-surface-500 shadow-sm overflow-hidden flex flex-col">
      <div className="flex flex-col gap-6 p-6">
        {/* Photo Section */}
        <div className="flex flex-col items-center gap-4">
          <div className="relative group">
            <div className="h-32 w-32 rounded-full border-4 border-white dark:border-surface-500 shadow-md overflow-hidden bg-slate-100 dark:bg-surface-400 flex items-center justify-center">
              {photoUrl ? (
                <img src={photoUrl} alt={user?.full_name} className="h-full w-full object-cover" />
              ) : (
                <User className="h-16 w-16 text-slate-300 dark:text-surface-300" strokeWidth={1} />
              )}
            </div>
            <button 
              type="button"
              onClick={onPhotoClick}
              disabled={photoLoading}
               className="absolute bottom-1 right-1 h-8 w-8 rounded-full bg-brand-500 hover:bg-brand-400 text-white flex items-center justify-center shadow-lg transition-all transform group-hover:scale-110 disabled:opacity-50"
            >
              <Camera className="h-4 w-4" />
            </button>
          </div>
          
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 leading-tight">
              {user?.full_name}
            </h2>
            <span className="inline-flex items-center gap-1.5 mt-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-surface-400 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-300">
              <ShieldCheck className="h-3 w-3" />
              {(user as any)?.role?.name || (user as any)?.role || "User"}
            </span>
          </div>
        </div>

        <div className="h-px bg-slate-100 dark:bg-surface-400" />

        {/* Details Section */}
        <div className="space-y-4">
          <DetailItem 
            icon={<Mail className="h-3.5 w-3.5" />} 
            label="Email Address" 
            value={user?.email} 
          />
          <DetailItem 
            icon={<Building2 className="h-3.5 w-3.5" />} 
            label="Assigned Office" 
            value={(user as any)?.owner_office?.code || (user as any)?.office?.code || "No Office"} 
          />
          <DetailItem 
            icon={<Fingerprint className="h-3.5 w-3.5" />} 
            label="Employee ID / User ID" 
            value={`USR-${String(user?.id).padStart(4, '0')}`} 
          />
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-surface-400">
           <Button 
            variant="secondary" 
            className="w-full font-bold h-10 shadow-sm"
            onClick={onEdit}
          >
            Edit Personal Info
          </Button>
        </div>
      </div>
    </div>
  );
};

interface DetailItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string;
}

const DetailItem: React.FC<DetailItemProps> = ({ icon, label, value }) => (
  <div className="flex flex-col gap-1">
    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
      {icon}
      {label}
    </div>
    <p className="text-[13.5px] font-medium text-slate-700 dark:text-slate-200">
      {value || "—"}
    </p>
  </div>
);
