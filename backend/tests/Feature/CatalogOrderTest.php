<?php

namespace Tests\Feature;

use App\Models\Catalog;
use App\Models\CatalogCategory;
use App\Models\CatalogItem;
use App\Models\Device;
use App\Models\Order;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

class CatalogOrderTest extends TestCase
{
    use RefreshDatabase;

    protected function actingAsUser(User $user, Organization $org)
    {
        $token = JWTAuth::claims(['organization_id' => $org->id])->fromUser($user);
        return $this->withHeader('Authorization', 'Bearer ' . $token);
    }

    protected function actingAsDevice(Device $device)
    {
        // Issue token as device
        $user = User::whereHas('organizations', function ($q) use ($device) {
            $q->where('organizations.id', $device->organization_id);
        })->first();

        $token = JWTAuth::claims([
            'organization_id' => $device->organization_id,
            'device_id' => $device->id,
            'role' => 'guest'
        ])->fromUser($user);

        return $this->withHeader('Authorization', 'Bearer ' . $token);
    }

    private function setupTenant(string $suffix, string $role = 'admin')
    {
        $org = Organization::create([
            'name' => "組織_{$suffix}",
        ]);
        $user = User::create([
            'email' => "user_{$suffix}@example.com",
            'login_id' => "user_{$suffix}",
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($user->id, ['role' => $role]);

        return [$org, $user];
    }

    /**
     * Test device registration by admin, and subsequent auth of the device.
     */
    public function test_device_registration_and_authentication()
    {
        [$org, $admin] = $this->setupTenant('a', 'admin');

        // 1. Admin registers new device
        $response = $this->actingAsUser($admin, $org)->postJson('/api/catalog/devices/register', [
            'name' => 'テーブル1',
            'device_code' => 'dev-code-12345',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.name', 'テーブル1')
            ->assertJsonStructure(['data' => ['access_token']]);

        $accessToken = $response->json('data.access_token');

        $this->assertDatabaseHas('devices', [
            'organization_id' => $org->id,
            'device_code' => 'dev-code-12345',
            'name' => 'テーブル1',
        ]);

        // 2. Kiosk Device logs in with issued code and token
        $authResponse = $this->postJson('/api/catalog/devices/auth', [
            'device_code' => 'dev-code-12345',
            'access_token' => $accessToken,
        ]);

        $authResponse->assertStatus(200)
            ->assertJsonStructure(['access_token', 'device']);
    }

    /**
     * Test config auto-creation and unlock code verification.
     */
    public function test_catalog_config_and_unlock()
    {
        [$org, $admin] = $this->setupTenant('a', 'admin');

        // Config should auto-create on first GET
        $response = $this->actingAsUser($admin, $org)->getJson('/api/catalog/config');
        $response->assertStatus(200)
            ->assertJsonPath('data.show_price', true)
            ->assertJsonPath('data.device_label', 'テーブル');

        $this->assertDatabaseHas('catalogs', ['organization_id' => $org->id]);

        // Update config
        $updateResponse = $this->actingAsUser($admin, $org)->putJson('/api/catalog/config', [
            'unlock_password' => '9999',
            'show_price' => false,
            'device_label' => '部屋',
        ]);
        $updateResponse->assertStatus(200)
            ->assertJsonPath('data.device_label', '部屋')
            ->assertJsonPath('data.show_price', false);

        // Verify password hash is checkable
        $unlockResponse = $this->actingAsUser($admin, $org)->postJson('/api/catalog/unlock', [
            'unlock_password' => '9999',
        ]);
        $unlockResponse->assertStatus(200);

        // Incorrect password fails
        $failResponse = $this->actingAsUser($admin, $org)->postJson('/api/catalog/unlock', [
            'unlock_password' => '0000',
        ]);
        $failResponse->assertStatus(422);
    }

    /**
     * Test order placement and price calculations.
     */
    public function test_order_placement_and_price_logic()
    {
        [$org, $admin] = $this->setupTenant('a', 'admin');

        // Setup Device
        $device = Device::create([
            'organization_id' => $org->id,
            'device_code' => 'dev-1',
            'name' => 'Room 101',
            'access_token' => 'token-1',
        ]);

        // Setup Menu Categories & Items
        $cat = CatalogCategory::create([
            'organization_id' => $org->id,
            'name' => 'ドリンク',
            'sort_order' => 1,
        ]);

        $item1 = CatalogItem::create([
            'organization_id' => $org->id,
            'category_id' => $cat->id,
            'name' => '生ビール',
            'price' => 500,
            'sort_order' => 1,
        ]);

        $item2 = CatalogItem::create([
            'organization_id' => $org->id,
            'category_id' => $cat->id,
            'name' => '烏龍茶',
            'price' => 200,
            'sort_order' => 2,
        ]);

        // Place order as device
        $response = $this->actingAsDevice($device)->postJson('/api/catalog/orders', [
            'items' => [
                ['id' => $item1->id, 'quantity' => 2], // 500 * 2 = 1000
                ['id' => $item2->id, 'quantity' => 1], // 200 * 1 = 200
            ]
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('data.total_price', 1200);

        $this->assertDatabaseHas('orders', [
            'organization_id' => $org->id,
            'device_id' => $device->id,
            'total_price' => 1200,
            'status' => 'ordered',
        ]);

        $this->assertDatabaseHas('order_items', [
            'item_id' => $item1->id,
            'quantity' => 2,
            'price' => 500,
        ]);
    }

    /**
     * Test order placement when price is hidden (Nursing Home scenario).
     */
    public function test_order_price_nullification_when_price_hidden()
    {
        [$org, $admin] = $this->setupTenant('a', 'admin');

        // Hide prices in catalog configuration
        Catalog::create([
            'organization_id' => $org->id,
            'unlock_password' => Hash::make('1234'),
            'show_price' => false,
            'device_label' => 'ベッド',
        ]);

        $device = Device::create([
            'organization_id' => $org->id,
            'device_code' => 'dev-2',
            'name' => 'ベッドA',
            'access_token' => 'token-2',
        ]);

        $cat = CatalogCategory::create([
            'organization_id' => $org->id,
            'name' => 'ケア要請',
        ]);

        $item = CatalogItem::create([
            'organization_id' => $org->id,
            'category_id' => $cat->id,
            'name' => 'お水を持ってきて',
            'price' => 100, // DB has price, but catalog hidden
        ]);

        $response = $this->actingAsDevice($device)->postJson('/api/catalog/orders', [
            'items' => [
                ['id' => $item->id, 'quantity' => 1]
            ]
        ]);

        // Total price and items prices must be NULL due to show_price = false
        $response->assertStatus(201)
            ->assertJsonPath('data.total_price', null);

        $this->assertDatabaseHas('orders', [
            'organization_id' => $org->id,
            'total_price' => null,
        ]);

        $this->assertDatabaseHas('order_items', [
            'item_id' => $item->id,
            'price' => null,
        ]);
    }

    /**
     * Test multi-tenant isolation and security guards.
     */
    public function test_multitenant_isolation_guards()
    {
        [$orgA, $adminA] = $this->setupTenant('a', 'admin');
        [$orgB, $adminB] = $this->setupTenant('b', 'admin');

        // Tenant A setup
        $deviceA = Device::create([
            'organization_id' => $orgA->id,
            'device_code' => 'dev-a',
            'name' => 'A-1',
            'access_token' => 'token-a',
        ]);
        
        $catA = CatalogCategory::create([
            'organization_id' => $orgA->id,
            'name' => 'Aカテゴリ',
        ]);

        $itemA = CatalogItem::create([
            'organization_id' => $orgA->id,
            'category_id' => $catA->id,
            'name' => 'Aアイテム',
        ]);

        // Tenant B setup
        $deviceB = Device::create([
            'organization_id' => $orgB->id,
            'device_code' => 'dev-b',
            'name' => 'B-1',
            'access_token' => 'token-b',
        ]);

        $catB = CatalogCategory::create([
            'organization_id' => $orgB->id,
            'name' => 'Bカテゴリ',
        ]);

        $itemB = CatalogItem::create([
            'organization_id' => $orgB->id,
            'category_id' => $catB->id,
            'name' => 'Bアイテム',
        ]);

        // 1. Device A attempts to order Item B (should fail with 404 because Item B is out of scope)
        $response = $this->actingAsDevice($deviceA)->postJson('/api/catalog/orders', [
            'items' => [
                ['id' => $itemB->id, 'quantity' => 1]
            ]
        ]);
        // Laravel custom validation check (exists in catalog_items) will fail 
        // because the item belongs to Tenant B and is invisible to Tenant A via Multitenant scope
        $response->assertStatus(422);

        // 2. Admin A tries to access Tenant B's order (should get 404)
        $orderB = Order::create([
            'organization_id' => $orgB->id,
            'device_id' => $deviceB->id,
            'status' => 'ordered',
        ]);

        $response = $this->actingAsUser($adminA, $orgA)->putJson("/api/catalog/orders/{$orderB->id}/status", [
            'status' => 'preparing'
        ]);
        $response->assertStatus(404);
    }
}
