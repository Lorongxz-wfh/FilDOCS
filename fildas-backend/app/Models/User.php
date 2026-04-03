<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\SoftDeletes;
use Laravel\Sanctum\HasApiTokens;
use Illuminate\Support\Facades\Storage;


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
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];


    protected $appends = ['full_name', 'profile_photo_url', 'signature_url'];

    public function getProfilePhotoUrlAttribute(): ?string
    {
        if ($this->profile_photo_path) {
            return asset(Storage::disk('public')->url($this->profile_photo_path));
        }
        
        return null;
    }

    public function getSignatureUrlAttribute(): ?string
    {
        if (!$this->signature_path) return null;
        return asset(Storage::disk('public')->url($this->signature_path));
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
