<?php

namespace Tests\Feature;

use App\Models\Document;
use App\Models\DocumentVersion;
use App\Models\WorkflowTask;
use App\Services\WorkflowSteps;
use PHPUnit\Framework\Attributes\Test;
use Tests\TestCase;

class DocumentWorkflowTest extends TestCase
{
    #[Test]
    public function qa_can_create_a_draft_and_submit_for_review()
    {
        $qa = $this->createQaUser();
        $officeUser = $this->createOfficeUser('HR');

        // 1. Create Draft
        $response = $this->actingAs($qa)->postJson('/api/documents', [
            'title' => 'Test Document',
            'description' => 'A test description',
            'doctype' => 'Internal Memorandum',
            'routing_mode' => 'default',
            'workflow_type' => 'qa',
            'review_office_id' => $officeUser->office_id,
        ]);

        $response->assertStatus(201);
        
        // DocumentResource typically wraps the model in a 'data' key
        $documentData = $response->json('data');
        $documentId = $documentData['id'];
        
        $version = DocumentVersion::where('document_id', $documentId)->first();

        $this->assertDatabaseHas('documents', ['id' => $documentId, 'title' => 'Test Document']);
        $this->assertEquals(WorkflowSteps::STATUS_DRAFT, $version->status);

        // 2. Submit to Office for Review
        $response = $this->actingAs($qa)->postJson("/api/document-versions/{$version->id}/actions", [
            'action' => WorkflowSteps::ACTION_QA_SEND_TO_OFFICE_REVIEW,
            'note' => 'Please review this policy draft.',
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('message', 'Workflow updated.');

        // Verify version status moved to "For Office Review"
        $this->assertDatabaseHas('document_versions', [
            'id' => $version->id,
            'status' => WorkflowSteps::STATUS_QA_OFFICE_REVIEW
        ]);

        // Verify task created for HR office
        $this->assertDatabaseHas('workflow_tasks', [
            'document_version_id' => $version->id,
            'assigned_office_id' => $officeUser->office_id,
            'phase' => WorkflowSteps::PHASE_REVIEW,
            'status' => 'open'
        ]);
    }

    #[Test]
    public function office_users_cannot_bypass_workflow()
    {
        $officeUser = $this->createOfficeUser('HR');
        $otherOfficeUser = $this->createOfficeUser('IT');
        
        // Create a QA-start document as a QA user (background setup)
        $document = Document::factory()->create([
            'owner_office_id' => \App\Models\Office::where('code', 'QA')->value('id') ?? 1,
            'created_by' => 1 // simplified
        ]);
        $version = DocumentVersion::factory()->create([
            'document_id' => $document->id,
            'status' => WorkflowSteps::STATUS_DRAFT
        ]);
        WorkflowTask::factory()->create([
            'document_version_id' => $version->id,
            'assigned_office_id' => $document->owner_office_id,
            'status' => 'open'
        ]);

        // Try to submit as an unassigned office user
        $response = $this->actingAs($otherOfficeUser)->postJson("/api/document-versions/{$version->id}/actions", [
            'action' => WorkflowSteps::ACTION_QA_SEND_TO_OFFICE_REVIEW,
        ]);

        // Should fail because it's not assigned to IT
        $response->assertStatus(422); // Logic usually returns 422 with a message
    }
}
