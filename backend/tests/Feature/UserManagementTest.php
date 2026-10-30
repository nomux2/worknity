<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function actingAsUser(User $user, Organization $org)
    {
        $token = JWTAuth::claims(['organization_id' => $org->id])->fromUser($user);
        return $this->withHeader('Authorization', 'Bearer ' . $token);
    }

    /**
     * Test admin can fetch users list.
     */
    public function test_list_users_as_admin()
    {
        $org = Organization::create(['name' => 'テスト組織']);
        
        $admin = User::create([
            'email' => 'admin@example.com',
            'login_id' => 'admin',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($admin->id, ['role' => 'admin']);

        $staff = User::create([
            'email' => 'staff@example.com',
            'login_id' => 'staff',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($staff->id, ['role' => 'staff']);

        $response = $this->actingAsUser($admin, $org)->getJson('/api/users');

        $response->assertStatus(200)
            ->assertJsonCount(2)
            ->assertJsonFragment(['email' => 'admin@example.com', 'role' => 'admin'])
            ->assertJsonFragment(['email' => 'staff@example.com', 'role' => 'staff']);
    }

    /**
     * Test staff cannot fetch users list.
     */
    public function test_list_users_as_staff_fails()
    {
        $org = Organization::create(['name' => 'テスト組織']);

        $staff = User::create([
            'email' => 'staff@example.com',
            'login_id' => 'staff',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($staff->id, ['role' => 'staff']);

        $response = $this->actingAsUser($staff, $org)->getJson('/api/users');

        $response->assertStatus(403);
    }

    /**
     * Test admin can add a new staff member.
     */
    public function test_add_staff_as_admin()
    {
        $org = Organization::create(['name' => 'テスト組織']);
        
        $admin = User::create([
            'email' => 'admin@example.com',
            'login_id' => 'admin',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($admin->id, ['role' => 'admin']);

        $response = $this->actingAsUser($admin, $org)->postJson('/api/users', [
            'email' => 'new_staff@example.com',
            'login_id' => 'newstaff',
            'password' => 'password123',
        ]);

        $response->assertStatus(201)
            ->assertJsonFragment([
                'email' => 'new_staff@example.com',
                'role' => 'staff',
            ]);

        $this->assertDatabaseHas('users', [
            'email' => 'new_staff@example.com',
        ]);
    }

    /**
     * Test validation failure during staff creation.
     */
    public function test_add_staff_validation_fails()
    {
        $org = Organization::create(['name' => 'テスト組織']);
        
        $admin = User::create([
            'email' => 'admin@example.com',
            'login_id' => 'admin',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($admin->id, ['role' => 'admin']);

        // 1. Password too short
        $response = $this->actingAsUser($admin, $org)->postJson('/api/users', [
            'email' => 'new_staff@example.com',
            'password' => 'short',
        ]);
        $response->assertStatus(422);

        // 2. Duplicate email
        $response = $this->actingAsUser($admin, $org)->postJson('/api/users', [
            'email' => 'admin@example.com',
            'password' => 'password123',
        ]);
        $response->assertStatus(422);
    }
}
