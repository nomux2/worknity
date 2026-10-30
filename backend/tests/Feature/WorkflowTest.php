<?php

namespace Tests\Feature;

use App\Models\ApprovalClass;
use App\Models\Organization;
use App\Models\Partner;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Report;
use App\Models\ReportApproval;
use App\Models\ReportTemplate;
use App\Models\Stock;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

class WorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected function actingAsUser(User $user, Organization $org)
    {
        $this->flushHeaders();
        try {
            auth('api')->logout();
        } catch (\Exception $e) {}
        auth()->forgetUser();
        $token = JWTAuth::claims(['organization_id' => $org->id])->fromUser($user);
        return $this->withHeader('Authorization', 'Bearer ' . $token);
    }

    private function setupTenant(string $name, string $role = 'admin')
    {
        $org = Organization::create(['name' => $name]);
        $user = User::create([
            'email' => strtolower($name) . '@example.com',
            'login_id' => strtolower($name) . 'user',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($user->id, ['role' => $role]);

        return [$org, $user];
    }

    /**
     * Test Tenant isolation and Basic CRUD for Classes and Templates.
     */
    public function test_workflow_metadata_tenant_isolation()
    {
        list($orgA, $adminA) = $this->setupTenant('TenantA', 'admin');
        list($orgB, $adminB) = $this->setupTenant('TenantB', 'admin');

        // Create class in Tenant A
        $classA = ApprovalClass::create([
            'organization_id' => $orgA->id,
            'name' => '部長クラス',
            'priority' => 20
        ]);

        // Attempt access from Tenant B -> Expect 404
        $this->actingAsUser($adminB, $orgB);
        $response = $this->getJson("/api/approval-classes/{$classA->id}");
        $response->assertStatus(404);

        // Access from Tenant A -> Expect 200
        $this->actingAsUser($adminA, $orgA);
        $response = $this->getJson("/api/approval-classes/{$classA->id}");
        $response->assertStatus(200);
        $response->assertJsonPath('data.name', '部長クラス');
    }

    /**
     * Test dynamic template routes validation and submit.
     */
    public function test_workflow_submission_and_approvals()
    {
        list($orgA, $adminA) = $this->setupTenant('TenantA', 'admin');
        
        // Create staff user in Tenant A
        $staffA = User::create([
            'email' => 'staffa@example.com',
            'login_id' => 'staffa',
            'password' => Hash::make('password123'),
            'default_organization_id' => $orgA->id,
        ]);
        $orgA->users()->attach($staffA->id, ['role' => 'staff']);

        // Create approval class & assign adminA to it
        $classA = ApprovalClass::create([
            'organization_id' => $orgA->id,
            'name' => '決裁者',
            'priority' => 10
        ]);
        $adminA->approvalClasses()->attach($classA->id, ['organization_id' => $orgA->id]);

        // Create Template
        $template = ReportTemplate::create([
            'organization_id' => $orgA->id,
            'name' => '経費精算申請',
            'type' => 'application',
            'steps_count' => 1,
            'fields' => [
                ['name' => 'amount', 'label' => '金額', 'type' => 'number', 'required' => true, 'step' => 1]
            ]
        ]);

        // Define routes
        $template->routes()->create([
            'organization_id' => $orgA->id,
            'step_number' => 1,
            'approver_type' => 'class',
            'approval_class_id' => $classA->id
        ]);

        // Staff submits a report
        $this->actingAsUser($staffA, $orgA);
        $response = $this->postJson('/api/reports', [
            'report_template_id' => $template->id,
            'status' => 'pending',
            'attributes' => ['amount' => 5000]
        ]);

        $response->assertStatus(201);
        $reportId = $response->json('data.id');

        // Check report exists
        $report = Report::find($reportId);
        $this->assertEquals('pending', $report->status);
        $this->assertEquals(1, $report->current_step);

        // Staff attempts to approve own report -> Expect 400
        $response = $this->postJson("/api/reports/{$reportId}/approve");
        $response->assertStatus(400);

        // Admin approves the report
        $this->actingAsUser($adminA, $orgA);
        $response = $this->postJson("/api/reports/{$reportId}/approve", [
            'comment' => '承認します。'
        ]);

        $response->assertStatus(200);
        
        // Assert Report status updated to completed/approved and approval log written
        $report->refresh();
        $this->assertEquals('approved', $report->status);
        
        $this->assertDatabaseHas('report_approvals', [
            'report_id' => $reportId,
            'user_id' => $adminA->id,
            'action' => 'approved',
            'comment' => '承認します。'
        ]);
    }

    /**
     * Test PurchaseOrder setting requirements and automated workflow triggers.
     */
    public function test_purchase_order_automated_approval_flow()
    {
        list($orgA, $adminA) = $this->setupTenant('TenantA', 'admin');

        // Create partner and stock item
        $partner = Partner::create(['organization_id' => $orgA->id, 'name' => '仕入先A']);
        $stock = Stock::create(['organization_id' => $orgA->id, 'product_name' => '商品A', 'quantity' => 10]);

        // Create Approval template & routes
        $template = ReportTemplate::create([
            'organization_id' => $orgA->id,
            'name' => '購買申請',
            'type' => 'application',
            'steps_count' => 1,
            'fields' => [
                ['name' => 'title', 'label' => '件名', 'type' => 'text', 'required' => true]
            ]
        ]);
        $template->routes()->create([
            'organization_id' => $orgA->id,
            'step_number' => 1,
            'approver_type' => 'user',
            'approver_user_id' => $adminA->id
        ]);

        // Setup PO Settings (Required approval for order >= 10,000 yen)
        $this->actingAsUser($adminA, $orgA);
        $this->putJson('/api/purchase-orders/settings', [
            'require_approval' => true,
            'approval_threshold' => 10000,
            'report_template_id' => $template->id
        ])->assertStatus(200);

        // 1. Create a draft PO with value < 10,000 yen (¥5,000)
        $draftResponse = $this->postJson('/api/purchase-orders', [
            'partner_id' => $partner->id,
            'order_date' => date('Y-m-d'),
            'items' => [
                ['stock_id' => $stock->id, 'quantity' => 5, 'unit_price' => 1000] // Total 5,000 yen
            ]
        ]);
        $draftResponse->assertStatus(201);
        $poId1 = $draftResponse->json('data.id');

        // Transition status to ordered -> Expect direct transition to ordered since < threshold
        $this->putJson("/api/purchase-orders/{$poId1}/status", ['status' => 'ordered'])->assertStatus(200);
        $this->assertDatabaseHas('purchase_orders', ['id' => $poId1, 'status' => 'ordered']);

        // 2. Create a draft PO with value >= 10,000 yen (¥15,000)
        $draftResponse2 = $this->postJson('/api/purchase-orders', [
            'partner_id' => $partner->id,
            'order_date' => date('Y-m-d'),
            'items' => [
                ['stock_id' => $stock->id, 'quantity' => 15, 'unit_price' => 1000] // Total 15,000 yen
            ]
        ]);
        $poId2 = $draftResponse2->json('data.id');

        // Transition status to ordered -> Expect transition to pending_approval and report creation
        $confirmResponse = $this->putJson("/api/purchase-orders/{$poId2}/status", ['status' => 'ordered']);
        $confirmResponse->assertStatus(200);
        $this->assertDatabaseHas('purchase_orders', ['id' => $poId2, 'status' => 'pending_approval']);

        // Check if report was created dynamically linking polymorphically to this PurchaseOrder
        $report = Report::where('approvable_type', 'App\Models\PurchaseOrder')
                        ->where('approvable_id', $poId2)
                        ->first();
        $this->assertNotNull($report);
        $this->assertEquals('pending', $report->status);

        // Approve the report -> Expect PurchaseOrder status mirroring to ordered
        $this->postJson("/api/reports/{$report->id}/approve", ['comment' => '発注承認'])->assertStatus(200);

        // Assert PurchaseOrder status mirrored successfully
        $this->assertDatabaseHas('purchase_orders', ['id' => $poId2, 'status' => 'ordered']);
    }
}
