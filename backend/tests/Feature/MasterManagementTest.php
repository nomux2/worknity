<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\Organization;
use App\Models\Partner;
use App\Models\Stock;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

class MasterManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function actingAsUser(User $user, Organization $org)
    {
        $token = JWTAuth::claims(['organization_id' => $org->id])->fromUser($user);
        return $this->withHeader('Authorization', 'Bearer ' . $token);
    }

    /**
     * Test Admin can manage partners.
     */
    public function test_partner_crud_as_admin()
    {
        $org = Organization::create(['name' => 'テスト組織']);
        $admin = User::create([
            'email' => 'admin@example.com',
            'login_id' => 'admin',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($admin->id, ['role' => 'admin']);

        // 1. Create Partner
        $response = $this->actingAsUser($admin, $org)->postJson('/api/partners', [
            'name' => 'テスト取引先',
            'address' => '東京都渋谷区',
            'phone' => '03-1234-5678',
        ]);
        $response->assertStatus(201);
        $partnerId = $response->json('id');

        // 2. List Partners
        $response = $this->actingAsUser($admin, $org)->getJson('/api/partners');
        $response->assertStatus(200)->assertJsonCount(1);

        // 3. Show Partner
        $response = $this->actingAsUser($admin, $org)->getJson("/api/partners/{$partnerId}");
        $response->assertStatus(200);

        // 4. Update Partner
        $response = $this->actingAsUser($admin, $org)->putJson("/api/partners/{$partnerId}", [
            'name' => '更新取引先',
            'address' => '東京都港区',
            'phone' => '03-9876-5432',
        ]);
        $response->assertStatus(200);

        // 5. Delete Partner
        $response = $this->actingAsUser($admin, $org)->deleteJson("/api/partners/{$partnerId}");
        $response->assertStatus(200);
        $this->assertDatabaseMissing('partners', ['id' => $partnerId]);
    }

    /**
     * Test Staff cannot manage partners.
     */
    public function test_partner_actions_as_staff_fail()
    {
        $org = Organization::create(['name' => 'テスト組織']);
        $staff = User::create([
            'email' => 'staff@example.com',
            'login_id' => 'staff',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($staff->id, ['role' => 'staff']);

        $partner = Partner::create([
            'organization_id' => $org->id,
            'name' => 'テスト取引先',
        ]);

        // 1. Index fails
        $response = $this->actingAsUser($staff, $org)->getJson('/api/partners');
        $response->assertStatus(403);

        // 2. Store fails
        $response = $this->actingAsUser($staff, $org)->postJson('/api/partners', [
            'name' => '新規取引先',
        ]);
        $response->assertStatus(403);

        // 3. Update fails
        $response = $this->actingAsUser($staff, $org)->putJson("/api/partners/{$partner->id}", [
            'name' => '不正更新',
        ]);
        $response->assertStatus(403);

        // 4. Delete fails
        $response = $this->actingAsUser($staff, $org)->deleteJson("/api/partners/{$partner->id}");
        $response->assertStatus(403);
    }

    /**
     * Test Admin can manage customers.
     */
    public function test_customer_crud_as_admin()
    {
        $org = Organization::create(['name' => 'テスト組織']);
        $admin = User::create([
            'email' => 'admin@example.com',
            'login_id' => 'admin',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($admin->id, ['role' => 'admin']);

        // 1. Create Customer
        $response = $this->actingAsUser($admin, $org)->postJson('/api/customers', [
            'name' => '山田太郎',
            'kana' => 'ヤマダタロウ',
            'email' => 'yamada@example.com',
            'phone' => '090-1234-5678',
            'address' => '大阪府大阪市',
        ]);
        $response->assertStatus(201);
        $customerId = $response->json('id');

        // 2. List Customers
        $response = $this->actingAsUser($admin, $org)->getJson('/api/customers');
        $response->assertStatus(200)->assertJsonCount(1);

        // 3. Update Customer
        $response = $this->actingAsUser($admin, $org)->putJson("/api/customers/{$customerId}", [
            'name' => '山田花子',
            'kana' => 'ヤマダハナコ',
            'email' => 'hanako@example.com',
            'phone' => '090-8765-4321',
            'address' => '京都府京都市',
        ]);
        $response->assertStatus(200);

        // 4. Delete Customer
        $response = $this->actingAsUser($admin, $org)->deleteJson("/api/customers/{$customerId}");
        $response->assertStatus(200);
        $this->assertDatabaseMissing('customers', ['id' => $customerId]);
    }

    /**
     * Test Staff cannot delete customers but can read/write.
     */
    public function test_customer_actions_as_staff_fail()
    {
        $org = Organization::create(['name' => 'テスト組織']);
        $staff = User::create([
            'email' => 'staff@example.com',
            'login_id' => 'staff',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($staff->id, ['role' => 'staff']);

        $customer = Customer::create([
            'organization_id' => $org->id,
            'name' => '山田太郎',
            'kana' => 'ヤマダタロウ',
        ]);

        $response = $this->actingAsUser($staff, $org)->getJson('/api/customers');
        $response->assertStatus(200);

        $response = $this->actingAsUser($staff, $org)->postJson('/api/customers', [
            'name' => '新顧客',
            'kana' => 'シンコキャク',
        ]);
        $response->assertStatus(201);

        $response = $this->actingAsUser($staff, $org)->putJson("/api/customers/{$customer->id}", [
            'name' => '不正更新',
            'kana' => 'フセイコウシン',
        ]);
        $response->assertStatus(200);

        $response = $this->actingAsUser($staff, $org)->deleteJson("/api/customers/{$customer->id}");
        $response->assertStatus(403);
    }

    /**
     * Test Admin can manage stocks.
     */
    public function test_stock_master_update_delete_as_admin()
    {
        $org = Organization::create(['name' => 'テスト組織']);
        $admin = User::create([
            'email' => 'admin@example.com',
            'login_id' => 'admin',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($admin->id, ['role' => 'admin']);

        $stock = Stock::create([
            'organization_id' => $org->id,
            'product_name' => '初期商品',
            'quantity' => 10,
            'minimum_quantity' => 2,
        ]);

        // 1. Update Stock
        $response = $this->actingAsUser($admin, $org)->putJson("/api/stocks/{$stock->id}", [
            'product_name' => '更新商品',
            'minimum_quantity' => 5,
            'price' => 500,
            'brand_name' => 'ブランドA',
            'category_name' => 'カテゴリA',
        ]);
        $response->assertStatus(200);
        $this->assertEquals('更新商品', $response->json('product_name'));

        // 2. Delete Stock
        $response = $this->actingAsUser($admin, $org)->deleteJson("/api/stocks/{$stock->id}");
        $response->assertStatus(200);
        $this->assertDatabaseMissing('stocks', ['id' => $stock->id]);
    }

    /**
     * Test Staff cannot update/delete stocks.
     */
    public function test_stock_master_actions_as_staff_fail()
    {
        $org = Organization::create(['name' => 'テスト組織']);
        $staff = User::create([
            'email' => 'staff@example.com',
            'login_id' => 'staff',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($staff->id, ['role' => 'staff']);

        $stock = Stock::create([
            'organization_id' => $org->id,
            'product_name' => '初期商品',
            'quantity' => 10,
            'minimum_quantity' => 2,
        ]);

        // Update fails
        $response = $this->actingAsUser($staff, $org)->putJson("/api/stocks/{$stock->id}", [
            'product_name' => '不正更新',
        ]);
        $response->assertStatus(403);

        // Delete fails
        $response = $this->actingAsUser($staff, $org)->deleteJson("/api/stocks/{$stock->id}");
        $response->assertStatus(403);
    }
}
