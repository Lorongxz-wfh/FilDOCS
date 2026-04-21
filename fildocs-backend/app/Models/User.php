<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;


class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    public function role()
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'first_name',
        'middle_name',
        'last_name',
        'suffix',
        'profile_photo_path',
        'email',
        'password',
        'office_id',
        'role_id',
        'email_doc_updates',
        'email_approvals',
        'email_requests',
        'theme_preference',
        'must_change_password',
        'onboarding_progress',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];


    protected $appends = ['full_name', 'profile_photo_url', 'signature_url', 'two_factor_enabled'];

    public function getTwoFactorEnabledAttribute(): bool
    {
        return !is_null($this->two_factor_confirmed_at);
    }

    public function getProfilePhotoUrlAttribute(): ?string
    {
        if (!$this->profile_photo_path) return null;
        
        // If it's a Data URI (stored in DB), return it directly
        if (Str::startsWith($this->profile_photo_path, 'data:')) {
            return $this->profile_photo_path;
        }

        $diskName = config('filesystems.default') === 's3' ? 's3' : 'public';
        $url = Storage::disk($diskName)->url($this->profile_photo_path);
        
        // Final fallback: Ensure absolute URL and force HTTPS in production
        if ($url && !Str::startsWith($url, 'http')) {
            $base = rtrim(config('app.url'), '/');
            $url = $base . '/' . ltrim($url, '/');
        }

        if (config('app.env') === 'production' && $url) {
            $url = str_replace('http://', 'https://', $url);
        }
        
        return $url;
    }

    public function getSignatureUrlAttribute(): ?string
    {
        if (!$this->signature_path) return null;
        
        // If it's a Data URI (stored in DB), return it directly
        if (Str::startsWith($this->signature_path, 'data:')) {
            return $this->signature_path;
        }

        $diskName = config('filesystems.default') === 's3' ? 's3' : 'public';
        $url = Storage::disk($diskName)->url($this->signature_path);
        
        if ($url && !Str::startsWith($url, 'http')) {
            $base = rtrim(config('app.url'), '/');
            $url = $base . '/' . ltrim($url, '/');
        }

        if (config('app.env') === 'production' && $url) {
            $url = str_replace('http://', 'https://', $url);
        }
        
        return $url;
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at'  => 'datetime',
            'last_active_at'     => 'datetime',
            'disabled_at'        => 'datetime',
            'password'           => 'hashed',
            'email_doc_updates'  => 'boolean',
            'email_approvals'    => 'boolean',
            'email_requests'     => 'boolean',
            'must_change_password' => 'boolean',
            'onboarding_progress'  => 'array',
        ];
    }


    public function getFullNameAttribute(): string
    {
        $parts = [
            $this->first_name,
            $this->middle_name,
            $this->last_name,
        ];

        $name = trim(implode(' ', array_filter($parts)));

        if ($this->suffix) {
            $name .= ' ' . $this->suffix;
        }

        return $name;
    }


    public function office()
    {
        return $this->belongsTo(Office::class);
    }
}
