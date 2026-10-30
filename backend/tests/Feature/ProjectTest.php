<?php
 
namespace Tests\Feature;
 
use App\Models\Organization;
use App\Models\Project;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;
 
class ProjectTest extends TestCase
{
    use RefreshDatabase;
 
    protected function actingAsUser(User $user, Organization $org)
    {
        $token = JWTAuth::claims(['organization_id' => $org->id])->fromUser($user);
        return $this->withHeader('Authorization', 'Bearer ' . $token);
    }
 
    private function setupTenant(string $suffix, string $role = 'admin')
    {
        $org = Organization::create(['name' => "組織_{$suffix}"]);
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
     * Test project CRUD operations by admin.
     */
    public function test_project_crud_by_admin()
    {
        [$org, $admin] = $this->setupTenant('a', 'admin');
 
        // 1. Create
        $response = $this->actingAsUser($admin, $org)->postJson('/api/projects', [
            'name' => '現場Aビル新築工事',
            'description' => '電気設備工事一式',
            'status' => 'planned',
            'start_date' => '2026-06-01',
            'end_date' => '2026-08-31',
            'budget_hours' => 200,
        ]);
 
        $response->assertStatus(201)
            ->assertJsonPath('data.name', '現場Aビル新築工事');
 
        $projectId = $response->json('data.id');
 
        // 2. Read (List)
        $response = $this->actingAsUser($admin, $org)->getJson('/api/projects');
        $response->assertStatus(200)
            ->assertJsonCount(1, 'data');
 
        // 3. Read (Detail)
        $response = $this->actingAsUser($admin, $org)->getJson("/api/projects/{$projectId}");
        $response->assertStatus(200)
            ->assertJsonPath('data.description', '電気設備工事一式');
 
        // 4. Update
        $response = $this->actingAsUser($admin, $org)->putJson("/api/projects/{$projectId}", [
            'name' => '現場Aビル新築工事（変更）',
            'status' => 'active',
        ]);
        $response->assertStatus(200)
            ->assertJsonPath('data.name', '現場Aビル新築工事（変更）')
            ->assertJsonPath('data.status', 'active');
 
        // 5. Delete
        $response = $this->actingAsUser($admin, $org)->deleteJson("/api/projects/{$projectId}");
        $response->assertStatus(200);
 
        // Verify deletion
        $response = $this->actingAsUser($admin, $org)->getJson("/api/projects/{$projectId}");
        $response->assertStatus(404);
    }
 
    /**
     * Test project CRUD restrictions for general staff.
     */
    public function test_project_crud_restrictions_for_staff()
    {
        [$org, $staff] = $this->setupTenant('a', 'staff');
        [$orgAdmin, $admin] = $this->setupTenant('admin', 'admin'); // unrelated tenant for baseline
 
        // Staff cannot create project
        $response = $this->actingAsUser($staff, $org)->postJson('/api/projects', [
            'name' => 'スタッフによるプロジェクト',
        ]);
        $response->assertStatus(403);
    }
 
    /**
     * Test multi-tenant isolation of project resources.
     */
    public function test_multi_tenant_project_isolation()
    {
        [$orgA, $adminA] = $this->setupTenant('a', 'admin');
        [$orgB, $adminB] = $this->setupTenant('b', 'admin');
 
        // Create project in Tenant A
        $projectA = Project::create([
            'organization_id' => $orgA->id,
            'name' => 'プロジェクトA',
            'status' => 'planned',
        ]);
 
        // Admin B attempts to access Project A -> must return 404 (hidden)
        $response = $this->actingAsUser($adminB, $orgB)->getJson("/api/projects/{$projectA->id}");
        $response->assertStatus(404);
 
        // Admin B attempts to update Project A -> must return 404 (hidden)
        $response = $this->actingAsUser($adminB, $orgB)->putJson("/api/projects/{$projectA->id}", [
            'name' => '乗っ取り更新',
        ]);
        $response->assertStatus(404);
 
        // Admin B attempts to delete Project A -> must return 404 (hidden)
        $response = $this->actingAsUser($adminB, $orgB)->deleteJson("/api/projects/{$projectA->id}");
        $response->assertStatus(404);
    }
}
