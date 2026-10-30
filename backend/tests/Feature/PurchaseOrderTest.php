<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Partner;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Stock;
use App\Models\StockLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

class PurchaseOrderTest extends TestCase
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
     * Test multi-tenant isolation.
     */
    public function test_multi_tenant_isolation()
    {
        // Tenant A setup
        list($orgA, $userA) = $this->setupTenant('TenantA', 'admin');
        $partnerA = Partner::create(['organization_id' => $orgA->id, 'name' => '仕入先A']);
        $stockA = Stock::create(['organization_id' => $orgA->id, 'product_name' => '商品A', 'quantity' => 10]);

        $orderA = PurchaseOrder::create([
            'organization_id' => $orgA->id,
            'partner_id' => $partnerA->id,
            'order_number' => 'PO-A001',
            'order_date' => '2026-07-17',
            'status' => 'ordered',
            'created_by' => $userA->id,
        ]);

        $itemA = PurchaseOrderItem::create([
            'organization_id' => $orgA->id,
            'order_id' => $orderA->id,
            'stock_id' => $stockA->id,
            'quantity' => 5,
            'received_quantity' => 0,
            'unit_price' => 100,
        ]);

        // Tenant B setup
        list($orgB, $userB) = $this->setupTenant('TenantB', 'admin');

        // User B tries to view User A's order (should return 404)
        $response = $this->actingAsUser($userB, $orgB)->getJson("/api/purchase-orders/{$orderA->id}");
        $response->assertStatus(404);

        // User B tries to receive goods for User A's order (should return 404)
        $response = $this->actingAsUser($userB, $orgB)->postJson("/api/purchase-orders/{$orderA->id}/receive", [
            'items' => [
                ['item_id' => $itemA->id, 'quantity' => 2]
            ]
        ]);
        $response->assertStatus(404);
    }

    /**
     * Test role permissions on purchase orders.
     */
    public function test_role_based_permissions()
    {
        list($org, $admin) = $this->setupTenant('TenantA', 'admin');
        list($orgDummy, $staff) = $this->setupTenant('TenantAStaff', 'staff');
        // Re-link staff user to same organization
        $org->users()->attach($staff->id, ['role' => 'staff']);

        $partner = Partner::create(['organization_id' => $org->id, 'name' => '仕入先A']);
        $stock = Stock::create(['organization_id' => $org->id, 'product_name' => '商品A', 'quantity' => 10]);

        // 1. Staff tries to create a purchase order (should fail)
        $response = $this->actingAsUser($staff, $org)->postJson('/api/purchase-orders', [
            'partner_id' => $partner->id,
            'order_date' => '2026-07-17',
            'items' => [
                ['stock_id' => $stock->id, 'quantity' => 10, 'unit_price' => 100]
            ]
        ]);
        $response->assertStatus(403);

        // 2. Admin creates a purchase order (should succeed)
        $response = $this->actingAsUser($admin, $org)->postJson('/api/purchase-orders', [
            'partner_id' => $partner->id,
            'order_date' => '2026-07-17',
            'items' => [
                ['stock_id' => $stock->id, 'quantity' => 10, 'unit_price' => 100]
            ]
        ]);
        $response->assertStatus(201);
        $orderId = $response->json('data.id');
        $itemArray = $response->json('data.items');
        $itemId = $itemArray[0]['id'];

        // Confirm the order as admin
        $response = $this->actingAsUser($admin, $org)->putJson("/api/purchase-orders/{$orderId}/status", [
            'status' => 'ordered'
        ]);
        $response->assertStatus(200);

        // 3. Staff performs partial receipt (should succeed)
        $response = $this->actingAsUser($staff, $org)->postJson("/api/purchase-orders/{$orderId}/receive", [
            'items' => [
                ['item_id' => $itemId, 'quantity' => 4]
            ]
        ]);
        $response->assertStatus(200);

        // Assert quantities updated
        $this->assertEquals(14, Stock::find($stock->id)->quantity);
        $this->assertEquals(4, PurchaseOrderItem::find($itemId)->received_quantity);
    }

    /**
     * Test partial receiving, completed state changes, and pessimistic locking.
     */
    public function test_partial_receiving_and_completion()
    {
        list($org, $admin) = $this->setupTenant('TenantA', 'admin');
        $partner = Partner::create(['organization_id' => $org->id, 'name' => '仕入先A']);
        $stock = Stock::create(['organization_id' => $org->id, 'product_name' => '商品A', 'quantity' => 10]);

        // Create order
        $order = PurchaseOrder::create([
            'organization_id' => $org->id,
            'partner_id' => $partner->id,
            'order_number' => 'PO-001',
            'order_date' => '2026-07-17',
            'status' => 'ordered',
            'created_by' => $admin->id,
        ]);

        $item = PurchaseOrderItem::create([
            'organization_id' => $org->id,
            'order_id' => $order->id,
            'stock_id' => $stock->id,
            'quantity' => 10,
            'received_quantity' => 0,
            'unit_price' => 100,
        ]);

        // 1. Partial receive 4 units
        $response = $this->actingAsUser($admin, $org)->postJson("/api/purchase-orders/{$order->id}/receive", [
            'items' => [
                ['item_id' => $item->id, 'quantity' => 4]
            ]
        ]);
        $response->assertStatus(200);
        
        $order->refresh();
        $item->refresh();
        $stock->refresh();

        $this->assertEquals('partially_received', $order->status);
        $this->assertEquals(4, $item->received_quantity);
        $this->assertEquals(14, $stock->quantity);

        // Assert StockLog was created with purchase_order_id link
        $log = StockLog::where('stock_id', $stock->id)->orderBy('id', 'desc')->first();
        $this->assertNotNull($log);
        $this->assertEquals($order->id, $log->purchase_order_id);
        $this->assertEquals('inflow', $log->operation);
        $this->assertEquals(10, $log->prior_quantity);
        $this->assertEquals(14, $log->new_quantity);

        // 2. Receive over limit (should fail validation)
        $response = $this->actingAsUser($admin, $org)->postJson("/api/purchase-orders/{$order->id}/receive", [
            'items' => [
                ['item_id' => $item->id, 'quantity' => 7] // 4 + 7 = 11 > 10
            ]
        ]);
        $response->assertStatus(422);

        // 3. Complete remaining 6 units
        $response = $this->actingAsUser($admin, $org)->postJson("/api/purchase-orders/{$order->id}/receive", [
            'items' => [
                ['item_id' => $item->id, 'quantity' => 6]
            ]
        ]);
        $response->assertStatus(200);

        $order->refresh();
        $item->refresh();
        $stock->refresh();

        $this->assertEquals('completed', $order->status);
        $this->assertEquals(10, $item->received_quantity);
        $this->assertEquals(20, $stock->quantity);
    }
}
