<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Traits\LogsActivityTrait;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Mail;
use App\Mail\SupportIssueMail;
use App\Models\User;
use App\Models\Role;

class SupportController extends Controller
{
    use LogsActivityTrait;

    /**
     * Handle the support email submission.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function send(Request $request)
    {
        $data = $request->validate([
            'subject' => 'required|string|max:255',
            'message' => 'required|string|max:5000',
            'sender_email' => 'required|email',
            'attachments' => 'nullable|array|max:5',
            'attachments.*' => 'image|mimes:jpeg,png,jpg,gif|max:10240', // max 10MB per image
        ]);

        $user = $request->user();
        
        // 1. Process attachments
        $fileUrls = [];
        $absolutePaths = [];
        if ($request->hasFile('attachments')) {
            foreach ($request->file('attachments') as $file) {
                // Store in public disk
                $path = $file->store('support_attachments', 'public');
                if ($path) {
                    $fileUrls[] = Storage::disk('public')->url($path);
                    $absolutePaths[] = Storage::disk('public')->path($path);
                }
            }
        }

        // 2. Identify receivers
        $primaryReceiver = 'laquino@filamer.edu.ph';
        
        // Find all users with ADMIN or SYSADMIN roles
        $adminRoleIds = Role::whereIn('name', ['admin', 'sysadmin', 'ADMIN', 'SYSADMIN'])
            ->pluck('id');
            
        $adminEmails = User::whereIn('role_id', $adminRoleIds)
            ->whereNotNull('email')
            ->pluck('email')
            ->toArray();
            
        $allReceivers = array_unique(array_merge([$primaryReceiver], $adminEmails));

        // 3. Log the activity (DB audit trail)
        $this->logActivity(
            'support.email_sent',
            'User composed a support email via Help Center',
            $user?->id,
            $user?->office_id,
            [
                'from' => $data['sender_email'],
                'to' => $allReceivers,
                'subject' => $data['subject'],
                'message' => $data['message'],
                'attachments' => $fileUrls,
                'timestamp' => now()->toDateTimeString(),
            ]
        );

        // 4. Send the Real Email
        try {
            Mail::to($allReceivers)->send(new SupportIssueMail(
                senderName: $user?->full_name ?? 'FilDOCS User',
                senderEmail: $data['sender_email'],
                notifTitle: $data['subject'],
                notifMessage: $data['message'],
                attachmentPaths: $absolutePaths,
                appUrl: config('app.url'),
                appName: config('app.name', 'FilDOCS'),
            ));
        } catch (\Exception $e) {
            // Log issue but don't stop the flow (activity is already logged)
            \Log::error("Support Report Email Failure: " . $e->getMessage());
        }

        return response()->json([
            'status' => 'success',
            'message' => 'Support request submitted successfully. Our team will review it shortly.',
            'details' => [
                'receivers_count' => count($allReceivers),
                'attachments_count' => count($fileUrls),
            ]
        ]);
    }
}
