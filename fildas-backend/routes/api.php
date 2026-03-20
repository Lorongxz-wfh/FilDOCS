<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DocumentController;
use App\Http\Controllers\Api\WorkflowController;
use App\Http\Controllers\Api\DocumentMessageController;
use App\Http\Controllers\Api\PreviewController;
use App\Http\Controllers\Api\ActivityLogController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\OfficeController;
use App\Http\Controllers\Api\DocumentRequestController;
use App\Http\Controllers\Api\DocumentRequestFileController;
use App\Http\Controllers\Api\DocumentTemplateController;
use App\Http\Controllers\Api\ReportsController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\AdminOfficeController;
use App\Http\Controllers\Api\DocumentRequestMessageController;

// ── Public ─────────────────────────────────────────────────────────────────
Route::get('/ping', fn() => response()->json(['status' => 'ok']));
Route::post('/login', [AuthController::class, 'login']);
Route::get('/offices', [OfficeController::class, 'index']);

// ── Signed URLs (no auth middleware — signature is the guard) ──────────────
Route::get('/document-versions/{version}/preview', [DocumentController::class, 'previewSigned'])
    ->name('document-versions.preview')
    ->middleware('signed');

Route::get('/previews/{year}/{preview}/preview', [PreviewController::class, 'previewSigned'])
    ->name('previews.preview')
    ->middleware('signed');

Route::get('/document-requests/{request}/example/preview', [DocumentRequestFileController::class, 'requestExamplePreviewSigned'])
    ->name('document-requests.example.preview')
    ->middleware('signed');

Route::get('/document-request-items/{item}/example/preview', [\App\Http\Controllers\Api\DocumentRequestItemController::class, 'examplePreviewSigned'])
    ->name('document-request-items.example.preview')
    ->middleware('signed');

Route::get('/document-request-items/{item}/example/download', [\App\Http\Controllers\Api\DocumentRequestItemController::class, 'exampleDownloadSigned'])
    ->name('document-request-items.example.download')
    ->middleware('signed');

Route::get('/document-requests/{request}/example/download', [DocumentRequestFileController::class, 'requestExampleDownloadSigned'])
    ->name('document-requests.example.download')
    ->middleware('signed');

Route::get('/document-request-submission-files/{file}/preview', [DocumentRequestFileController::class, 'submissionFilePreviewSigned'])
    ->name('document-request-submission-files.preview')
    ->middleware('signed');

Route::get('/document-request-submission-files/{file}/download', [DocumentRequestFileController::class, 'submissionFileDownloadSigned'])
    ->name('document-request-submission-files.download')
    ->middleware('signed');

// ── Authenticated ──────────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    // ── Auth ───────────────────────────────────────────────────────────────
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', fn(Request $r) => $r->user());
    Route::get('/offices/{office}/users', [OfficeController::class, 'users']);

    // ── Workflow ───────────────────────────────────────────────────────────
    Route::prefix('document-versions/{version}')->group(function () {
        Route::get('/tasks',             [WorkflowController::class, 'tasks']);
        Route::get('/route-steps',       [WorkflowController::class, 'routeSteps']);
        Route::get('/available-actions', [WorkflowController::class, 'availableActions']);
        Route::post('/actions',          [WorkflowController::class, 'action']);
    });
    Route::get('/work-queue', [WorkflowController::class, 'workQueue']);

    // ── Documents ──────────────────────────────────────────────────────────
    Route::get('/documents/stats',    [DocumentController::class, 'stats']);
    Route::get('/documents/finished', [DocumentController::class, 'finished']);
    Route::get('/documents',          [DocumentController::class, 'index']);
    Route::post('/documents',       [DocumentController::class, 'store']);
    Route::get('/documents/{document}',         [DocumentController::class, 'show']);
    Route::patch('/documents/{document}',       [DocumentController::class, 'update']);
    Route::get('/documents/{document}/versions', [DocumentController::class, 'versions']);
    Route::get('/documents/{document}/tags',    [DocumentController::class, 'getTags']);
    Route::put('/documents/{document}/tags',    [DocumentController::class, 'setTags']);
    Route::get('/documents/{document}/shares',  [DocumentController::class, 'getShares']);
    Route::post('/documents/{document}/shares', [DocumentController::class, 'setShares']);
    Route::post('/documents/{document}/revision', [DocumentController::class, 'createRevision']);

    // ── Document Versions ──────────────────────────────────────────────────
    Route::get('/document-versions/{version}',              [DocumentController::class, 'showVersion']);
    Route::patch('/document-versions/{version}',            [DocumentController::class, 'updateVersion'])
        ->middleware('can:updateDraft,version');
    Route::post('/document-versions/{version}/replace-file', [DocumentController::class, 'replaceFile'])
        ->middleware('can:replaceFile,version');
    Route::post('/document-versions/{version}/cancel',      [DocumentController::class, 'cancelRevision'])
        ->middleware('can:cancel,version');
    Route::delete('/document-versions/{version}',           [DocumentController::class, 'destroyVersion'])
        ->middleware('can:destroy,version');
    Route::get('/document-versions/{version}/preview-link', [DocumentController::class, 'previewLink'])
        ->middleware('can:preview,version');
    Route::get('/document-versions/{version}/download',     [DocumentController::class, 'downloadVersion'])
        ->middleware('can:download,version');

    // ── Messages ───────────────────────────────────────────────────────────
    Route::get('/document-versions/{version}/messages',  [DocumentMessageController::class, 'index']);
    Route::post('/document-versions/{version}/messages', [DocumentMessageController::class, 'store']);

    // ── Previews (temp) ────────────────────────────────────────────────────
    Route::post('/previews',                      [PreviewController::class, 'store']);
    Route::delete('/previews/{year}/{preview}',   [PreviewController::class, 'destroy']);

    // ── Notifications ──────────────────────────────────────────────────────
    Route::get('/notifications',                          [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count',             [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/read-all',                [NotificationController::class, 'markAllRead']);
    Route::delete('/notifications',                       [NotificationController::class, 'destroyAll']);
    Route::post('/notifications/{notification}/read',     [NotificationController::class, 'markRead']);
    Route::delete('/notifications/{notification}',        [NotificationController::class, 'destroy']);

    // ── Activity ───────────────────────────────────────────────────────────
    Route::post('/activity/opened-version', [ActivityLogController::class, 'openedVersion']);
    Route::get('/activity',                 [ActivityLogController::class, 'index']);

    // ── Search ─────────────────────────────────────────────────────────────────
    Route::get('/search', \App\Http\Controllers\Api\SearchController::class);

    // ── Profile ────────────────────────────────────────────────────────────────
    Route::patch('/profile',                              [\App\Http\Controllers\Api\ProfileController::class, 'update']);
    Route::post('/profile/password',                      [\App\Http\Controllers\Api\ProfileController::class, 'changePassword']);
    Route::post('/profile/photo',                         [\App\Http\Controllers\Api\ProfileController::class, 'uploadPhoto']);
    Route::delete('/profile/photo',                       [\App\Http\Controllers\Api\ProfileController::class, 'removePhoto']);
    Route::patch('/profile/notification-preferences',     [\App\Http\Controllers\Api\ProfileController::class, 'updateNotificationPreferences']);

    // ── Reports ────────────────────────────────────────────────────────────────
    Route::get('/reports/approval',    [ReportsController::class, 'approval']);
    Route::get('/reports/compliance',  [ReportsController::class, 'compliance']);

    // ── Document Requests ──────────────────────────────────────────────────
    Route::get('/document-requests/{request}/messages',  [DocumentRequestMessageController::class, 'index']);
    Route::post('/document-requests/{request}/messages', [DocumentRequestMessageController::class, 'store']);
    Route::get('/document-requests/{request}/recipients/{recipient}',   [DocumentRequestController::class, 'showRecipient']);
    Route::patch('/document-requests/{request}/recipients/{recipient}', [DocumentRequestController::class, 'updateRecipient']);
    Route::get('/document-requests/{request}/items/{item}',             [DocumentRequestController::class, 'showItem']);
    Route::patch('/document-requests/{request}',         [DocumentRequestController::class, 'update']);
    Route::patch('/document-requests/{request}/status', [DocumentRequestController::class, 'updateStatus']);
    Route::patch('/document-request-items/{item}',       [DocumentRequestController::class, 'updateItem']);
    Route::post('/document-request-items/{item}/example', [\App\Http\Controllers\Api\DocumentRequestItemController::class, 'uploadExample']);
    Route::get('/document-request-items/{item}/example/preview-link', [\App\Http\Controllers\Api\DocumentRequestItemController::class, 'examplePreviewLink']);
    Route::get('/document-request-items/{item}/example/download-link', [\App\Http\Controllers\Api\DocumentRequestItemController::class, 'exampleDownloadLink']);
    Route::get('/document-requests',         [DocumentRequestController::class, 'index']);
    Route::post('/document-requests',        [DocumentRequestController::class, 'store']);
    Route::get('/document-requests/inbox',       [DocumentRequestController::class, 'inbox']);
    Route::get('/document-requests/recipients',  [DocumentRequestController::class, 'indexRecipients']);
    Route::get('/document-requests/individual',  [DocumentRequestController::class, 'indexIndividual']);
    Route::get('/document-requests/{request}',   [DocumentRequestController::class, 'show']);
    Route::post(
        '/document-requests/{request}/recipients/{recipient}/submit',
        [DocumentRequestController::class, 'submit']
    );
    Route::post(
        '/document-request-submissions/{submission}/review',
        [DocumentRequestController::class, 'review']
    );

    // Document request signed link helpers
    Route::get(
        '/document-requests/{request}/example/preview-link',
        [DocumentRequestFileController::class, 'requestExamplePreviewLink']
    );
    Route::get(
        '/document-requests/{request}/example/download-link',
        [DocumentRequestFileController::class, 'requestExampleDownloadLink']
    );
    Route::get(
        '/document-request-submission-files/{file}/preview-link',
        [DocumentRequestFileController::class, 'submissionFilePreviewLink']
    );
    Route::get(
        '/document-request-submission-files/{file}/download-link',
        [DocumentRequestFileController::class, 'submissionFileDownloadLink']
    );

    // ── Templates ──────────────────────────────────────────────────────────
    Route::prefix('templates')->group(function () {
        Route::get('/',                    [DocumentTemplateController::class, 'index']);
        Route::post('/',                   [DocumentTemplateController::class, 'store']);
        Route::patch('/{template}/tags',   [DocumentTemplateController::class, 'updateTags']);
        Route::delete('/{template}',       [DocumentTemplateController::class, 'destroy']);
        Route::get('/{template}/download', [DocumentTemplateController::class, 'download']);
    });

    // ── Admin ──────────────────────────────────────────────────────────────
    Route::middleware('admin')->prefix('admin')->group(function () {
        Route::get('/dashboard-stats', [\App\Http\Controllers\Api\AdminDashboardController::class, 'stats']);
        Route::get('/users',                  [UserController::class, 'index']);
        Route::post('/users',                 [UserController::class, 'store']);
        Route::patch('/users/{user}',         [UserController::class, 'update']);
        Route::patch('/users/{user}/disable', [UserController::class, 'disable']);
        Route::patch('/users/{user}/enable',  [UserController::class, 'enable']);
        Route::delete('/users/{user}',        [UserController::class, 'destroy']);
        Route::post('/users/{user}/photo',    [UserController::class, 'uploadPhoto']);
        Route::delete('/users/{user}/photo',  [UserController::class, 'removePhoto']);
        Route::get('/roles',                  [UserController::class, 'roles']);

        Route::get('/offices',                    [AdminOfficeController::class, 'index']);
        Route::post('/offices',                   [AdminOfficeController::class, 'store']);
        Route::patch('/offices/{office}',         [AdminOfficeController::class, 'update']);
        Route::delete('/offices/{office}',        [AdminOfficeController::class, 'destroy']);
        Route::patch('/offices/{office}/restore', [AdminOfficeController::class, 'restore']);
    });
});
