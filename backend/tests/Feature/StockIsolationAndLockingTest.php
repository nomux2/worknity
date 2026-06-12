<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\Stock;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

class StockIsolationAndLockingTest extends TestCase
{
    use RefreshDatabase;

    protected function actingAsUser(User $user, Organization $org)
    {
        $token = JWTAuth::claims(['organization_id' => $org->id])->fromUser($user);
        return $this->withHeader('Authorization', 'Bearer ' . $token);
    }

    /**
     * Test hybrid credentials login (login_id or email).
     */
    public function test_hybrid_credentials_login()
    {
        // Create an organization
        $org = Organization::create(['name' => 'テスト組織']);

        // Create user with both email and login_id
        $user = User::create([
            'email' => 'test@example.com',
            'login_id' => 'testuser',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($user->id, ['role' => 'admin']);

        // 1. Login with email
        $response = $this->postJson('/api/auth/login', [
            'login_id' => 'test@example.com',
            'password' => 'password123',
        ]);
        $response->assertStatus(200)
            ->assertJsonStructure(['access_token', 'user']);

        // 2. Login with login_id
        $response = $this->postJson('/api/auth/login', [
            'login_id' => 'testuser',
            'password' => 'password123',
        ]);
        $response->assertStatus(200)
            ->assertJsonStructure(['access_token', 'user']);
            
        // 3. Login with wrong password
        $response = $this->postJson('/api/auth/login', [
            'login_id' => 'testuser',
            'password' => 'wrongpassword',
        ]);
        $response->assertStatus(401);
    }

    /**
     * Test multi-tenant isolation of stock resources.
     */
    public function test_multi_tenant_stock_isolation()
    {
        // 1. Setup Tenant A
        $orgA = Organization::create(['name' => '組織A']);
        $userA = User::create([
            'email' => 'userA@example.com',
            'login_id' => 'usera',
            'password' => Hash::make('password123'),
            'default_organization_id' => $orgA->id,
        ]);
        $orgA->users()->attach($userA->id, ['role' => 'admin']);

        // Create Stock A under Tenant A
        $stockA = Stock::create([
            'organization_id' => $orgA->id,
            'product_name' => '商品A',
            'quantity' => 10,
            'minimum_quantity' => 5,
        ]);

        // 2. Setup Tenant B
        $orgB = Organization::create(['name' => '組織B']);
        $userB = User::create([
            'email' => 'userB@example.com',
            'login_id' => 'userb',
            'password' => Hash::make('password123'),
            'default_organization_id' => $orgB->id,
        ]);
        $orgB->users()->attach($userB->id, ['role' => 'admin']);

        // Create Stock B under Tenant B
        $stockB = Stock::create([
            'organization_id' => $orgB->id,
            'product_name' => '商品B',
            'quantity' => 20,
            'minimum_quantity' => 10,
        ]);

        // 3. Authenticate as User A and list stocks
        $response = $this->actingAsUser($userA, $orgA)->getJson('/api/stocks');
        $response->assertStatus(200);
        
        $data = $response->json('data');
        $this->assertCount(1, $data);
        $this->assertEquals('商品A', $data[0]['product_name']);

        // 4. Attempt to access or modify Tenant B's stock as User A (must return 404 to hide existence)
        $response = $this->actingAsUser($userA, $orgA)->postJson("/api/stocks/{$stockB->id}/inflow", [
            'quantity' => 5
        ]);
        $response->assertStatus(404);

        $response = $this->actingAsUser($userA, $orgA)->postJson("/api/stocks/{$stockB->id}/outflow", [
            'quantity' => 5
        ]);
        $response->assertStatus(404);

        $response = $this->actingAsUser($userA, $orgA)->putJson("/api/stocks/{$stockB->id}/stocktake", [
            'quantity' => 5
        ]);
        $response->assertStatus(404);
    }

    /**
     * Test stock operations (inflow, outflow, stocktake).
     */
    public function test_stock_operations()
    {
        $org = Organization::create(['name' => 'テスト組織']);
        $user = User::create([
            'email' => 'test@example.com',
            'login_id' => 'testuser',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($user->id, ['role' => 'admin']);

        $stock = Stock::create([
            'organization_id' => $org->id,
            'product_name' => 'テスト商品',
            'quantity' => 10,
            'minimum_quantity' => 5,
        ]);

        // 1. Inflow
        $response = $this->actingAsUser($user, $org)->postJson("/api/stocks/{$stock->id}/inflow", [
            'quantity' => 5
        ]);
        $response->assertStatus(200);
        $this->assertEquals(15, $response->json('quantity'));

        // 2. Outflow
        $response = $this->actingAsUser($user, $org)->postJson("/api/stocks/{$stock->id}/outflow", [
            'quantity' => 3
        ]);
        $response->assertStatus(200);
        $this->assertEquals(12, $response->json('quantity'));

        // 3. Outflow exceed quantity (should fail)
        $response = $this->actingAsUser($user, $org)->postJson("/api/stocks/{$stock->id}/outflow", [
            'quantity' => 20
        ]);
        $response->assertStatus(422);

        // 4. Stocktake
        $response = $this->actingAsUser($user, $org)->putJson("/api/stocks/{$stock->id}/stocktake", [
            'quantity' => 8
        ]);
        $response->assertStatus(200);
        $this->assertEquals(8, $response->json('quantity'));
    }
}
