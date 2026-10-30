<?php

namespace Tests\Feature;

use App\Models\Customer;
use App\Models\CustomerField;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

class CustomerManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function actingAsUser(User $user, Organization $org)
    {
        $token = JWTAuth::claims(['organization_id' => $org->id])->fromUser($user);
        return $this->withHeader('Authorization', 'Bearer ' . $token);
    }

    private function setupTenant(string $name, string $adminEmail, string $staffEmail)
    {
        $org = Organization::create(['name' => $name]);

        $admin = User::create([
            'email' => $adminEmail,
            'login_id' => $name . '_admin',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($admin->id, ['role' => 'admin']);

        $staff = User::create([
            'email' => $staffEmail,
            'login_id' => $name . '_staff',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($staff->id, ['role' => 'staff']);

        return [$org, $admin, $staff];
    }

    /**
     * Test Customer Field CRUD as Admin.
     */
    public function test_customer_field_crud_as_admin()
    {
        [$org, $admin, $staff] = $this->setupTenant('TenantA', 'admin@example.com', 'staff@example.com');

        // 1. Create custom field
        $response = $this->actingAsUser($admin, $org)->postJson('/api/customer-fields', [
            'field_key' => 'care_level',
            'field_name' => '介護度',
            'field_type' => 'select',
            'options' => ['要支援1', '要介護1', '要介護2'],
            'is_custom' => true,
            'is_enabled' => true,
            'is_searchable' => true,
            'sort_order' => 5,
        ]);
        $response->assertStatus(201);
        $fieldId = $response->json('id');

        // 2. Prevent duplicate keys in same tenant
        $responseDuplicate = $this->actingAsUser($admin, $org)->postJson('/api/customer-fields', [
            'field_key' => 'care_level',
            'field_name' => '別の名前',
            'field_type' => 'text',
        ]);
        $responseDuplicate->assertStatus(422);

        // 3. List fields
        $responseList = $this->actingAsUser($admin, $org)->getJson('/api/customer-fields');
        $responseList->assertStatus(200)->assertJsonCount(5);

        // 4. Update field
        $responseUpdate = $this->actingAsUser($admin, $org)->putJson("/api/customer-fields/{$fieldId}", [
            'field_name' => '要介護度',
            'field_type' => 'select',
            'options' => ['要支援1', '要支援2', '要介護1'],
            'is_enabled' => true,
            'is_searchable' => true,
            'sort_order' => 2,
        ]);
        $responseUpdate->assertStatus(200);
        $this->assertEquals('要介護度', $responseUpdate->json('field_name'));

        // 5. Delete field
        $responseDelete = $this->actingAsUser($admin, $org)->deleteJson("/api/customer-fields/{$fieldId}");
        $responseDelete->assertStatus(200);
        $this->assertDatabaseMissing('customer_fields', ['id' => $fieldId]);
    }

    /**
     * Test staff permissions on Customer Fields.
     */
    public function test_customer_field_actions_as_staff()
    {
        [$org, $admin, $staff] = $this->setupTenant('TenantA', 'admin@example.com', 'staff@example.com');

        $field = CustomerField::create([
            'organization_id' => $org->id,
            'field_key' => 'hair_type',
            'field_name' => '髪質',
            'field_type' => 'text',
            'is_custom' => true,
        ]);

        // Staff can read
        $response = $this->actingAsUser($staff, $org)->getJson('/api/customer-fields');
        $response->assertStatus(200)->assertJsonCount(5);

        // Staff cannot create
        $responseCreate = $this->actingAsUser($staff, $org)->postJson('/api/customer-fields', [
            'field_key' => 'blood_type',
            'field_name' => '血液型',
            'field_type' => 'text',
        ]);
        $responseCreate->assertStatus(403);

        // Staff cannot update
        $responseUpdate = $this->actingAsUser($staff, $org)->putJson("/api/customer-fields/{$field->id}", [
            'field_name' => '新しい髪質',
            'field_type' => 'text',
        ]);
        $responseUpdate->assertStatus(403);

        // Staff cannot delete
        $responseDelete = $this->actingAsUser($staff, $org)->deleteJson("/api/customer-fields/{$field->id}");
        $responseDelete->assertStatus(403);
    }

    /**
     * Test Customer CRUD permissions for Staff.
     */
    public function test_customer_crud_as_staff()
    {
        [$org, $admin, $staff] = $this->setupTenant('TenantA', 'admin@example.com', 'staff@example.com');

        // Staff can create customer
        $responseCreate = $this->actingAsUser($staff, $org)->postJson('/api/customers', [
            'name' => '山田太郎',
            'kana' => 'ヤマダタロウ',
            'phone' => '090-1111-2222',
        ]);
        $responseCreate->assertStatus(201);
        $customerId = $responseCreate->json('id');

        // Staff can update customer
        $responseUpdate = $this->actingAsUser($staff, $org)->putJson("/api/customers/{$customerId}", [
            'name' => '山田太郎',
            'kana' => 'ヤマダタロウ',
            'phone' => '090-9999-9999',
        ]);
        $responseUpdate->assertStatus(200);

        // Staff CANNOT delete customer
        $responseDeleteStaff = $this->actingAsUser($staff, $org)->deleteJson("/api/customers/{$customerId}");
        $responseDeleteStaff->assertStatus(403);
    }

    /**
     * Test Admin can delete customer.
     */
    public function test_customer_delete_as_admin()
    {
        [$org, $admin, $staff] = $this->setupTenant('TenantA', 'admin@example.com', 'staff@example.com');

        $customer = Customer::create([
            'organization_id' => $org->id,
            'name' => '山田太郎',
            'kana' => 'ヤマダタロウ',
        ]);

        // Admin CAN delete customer
        $responseDeleteAdmin = $this->actingAsUser($admin, $org)->deleteJson("/api/customers/{$customer->id}");
        $responseDeleteAdmin->assertStatus(200);
        $this->assertDatabaseMissing('customers', ['id' => $customer->id]);
    }

    /**
     * Test Customer Custom Fields dynamic validation.
     */
    public function test_customer_dynamic_validation()
    {
        [$org, $admin, $staff] = $this->setupTenant('TenantA', 'admin@example.com', 'staff@example.com');

        // Setup custom fields
        CustomerField::create([
            'organization_id' => $org->id,
            'field_key' => 'age',
            'field_name' => '年齢',
            'field_type' => 'number',
            'is_custom' => true,
        ]);
        CustomerField::create([
            'organization_id' => $org->id,
            'field_key' => 'joined_date',
            'field_name' => '入会日',
            'field_type' => 'date',
            'is_custom' => true,
        ]);

        // 1. Check validation fail for non-numeric age
        $responseFail1 = $this->actingAsUser($staff, $org)->postJson('/api/customers', [
            'name' => '山田',
            'kana' => 'ヤマダ',
            'age' => '二十歳',
        ]);
        $responseFail1->assertStatus(422);

        // 2. Check validation fail for invalid date format
        $responseFail2 = $this->actingAsUser($staff, $org)->postJson('/api/customers', [
            'name' => '山田',
            'kana' => 'ヤマダ',
            'joined_date' => '2026/06/24', // Should be YYYY-MM-DD
        ]);
        $responseFail2->assertStatus(422);

        // 3. Success with correct types
        $responseSuccess = $this->actingAsUser($staff, $org)->postJson('/api/customers', [
            'name' => '山田',
            'kana' => 'ヤマダ',
            'age' => 20,
            'joined_date' => '2026-06-24',
        ]);
        $responseSuccess->assertStatus(201);
        $this->assertEquals(20, $responseSuccess->json('attributes.age'));
        $this->assertEquals('2026-06-24', $responseSuccess->json('attributes.joined_date'));
    }

    /**
     * Test Customer dynamic filters/search.
     */
    public function test_customer_dynamic_search()
    {
        [$org, $admin, $staff] = $this->setupTenant('TenantA', 'admin@example.com', 'staff@example.com');

        CustomerField::create([
            'organization_id' => $org->id,
            'field_key' => 'care_level',
            'field_name' => '介護度',
            'field_type' => 'select',
            'is_custom' => true,
            'is_searchable' => true,
        ]);

        // Customer A: Care level = Level 1, Address = Aichi
        $customerA = Customer::create([
            'organization_id' => $org->id,
            'name' => '山田',
            'kana' => 'ヤマダ',
            'address' => '愛知県名古屋市',
            'attributes' => ['care_level' => 'Level 1'],
        ]);

        // Customer B: Care level = Level 2, Address = Shizuoka
        $customerB = Customer::create([
            'organization_id' => $org->id,
            'name' => '佐藤',
            'kana' => 'サトウ',
            'address' => '静岡県静岡市',
            'attributes' => ['care_level' => 'Level 2'],
        ]);

        // Search by address = Shizuoka
        $response1 = $this->actingAsUser($staff, $org)->getJson('/api/customers?address=静岡');
        $response1->assertStatus(200)->assertJsonCount(1);
        $this->assertEquals('佐藤', $response1->json('0.name'));

        // Search by custom field care_level = Level 1
        $response2 = $this->actingAsUser($staff, $org)->getJson('/api/customers?care_level=Level+1');
        $response2->assertStatus(200)->assertJsonCount(1);
        $this->assertEquals('山田', $response2->json('0.name'));

        // Search by custom field care_level = Level 2 AND address = Shizuoka
        $response3 = $this->actingAsUser($staff, $org)->getJson('/api/customers?care_level=Level+2&address=静岡');
        $response3->assertStatus(200)->assertJsonCount(1);
        $this->assertEquals('佐藤', $response3->json('0.name'));
    }

    /**
     * Test Multi-tenant isolation for Customers.
     */
    public function test_customer_multi_tenant_isolation()
    {
        [$orgA, $adminA, $staffA] = $this->setupTenant('TenantA', 'adminA@example.com', 'staffA@example.com');
        [$orgB, $adminB, $staffB] = $this->setupTenant('TenantB', 'adminB@example.com', 'staffB@example.com');

        $customerA = Customer::create([
            'organization_id' => $orgA->id,
            'name' => 'テナントA顧客',
            'kana' => 'テナントエーコキャク',
        ]);

        $customerB = Customer::create([
            'organization_id' => $orgB->id,
            'name' => 'テナントB顧客',
            'kana' => 'テナントビーコキャク',
        ]);

        // Tenant A staff lists customers -> should only see Tenant A's customer
        $responseList = $this->actingAsUser($staffA, $orgA)->getJson('/api/customers');
        $responseList->assertStatus(200)->assertJsonCount(1);
        $this->assertEquals('テナントA顧客', $responseList->json('0.name'));

        // Tenant A staff requests Tenant B's customer -> should return 404
        $responseShow = $this->actingAsUser($staffA, $orgA)->getJson("/api/customers/{$customerB->id}");
        $responseShow->assertStatus(404);
    }
}
