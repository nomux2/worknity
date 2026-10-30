<?php
 
namespace Tests\Feature;
 
use App\Models\Organization;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;
 
class TaskTest extends TestCase
{
    use RefreshDatabase;
 
    protected function actingAsUser(User $user, Organization $org)
    {
        $token = JWTAuth::claims(['organization_id' => $org->id])->fromUser($user);
        return $this->withHeader('Authorization', 'Bearer ' . $token);
    }
 
    private function setupTenant(string $suffix, string $role = 'admin')
    {
        $org = Organization::create([
            'name' => "組織_{$suffix}",
            'working_days' => '1,2,3,4,5',
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
     * Test task creation with repeat rule by admin.
     */
    public function test_task_creation_with_repeat_rule_by_admin()
    {
        [$org, $admin] = $this->setupTenant('a', 'admin');
 
        $response = $this->actingAsUser($admin, $org)->postJson('/api/tasks', [
            'name' => '朝の開店準備',
            'description' => 'エアコン起動、レジ金準備',
            'status' => 'todo',
            'planned_hours' => 1.0,
            'repeat_rule' => [
                'pattern' => 'daily',
                'details' => [],
                'non_working_day_behavior' => 'skip',
            ]
        ]);
 
        $response->assertStatus(201)
            ->assertJsonPath('data.name', '朝の開店準備')
            ->assertJsonStructure(['data' => ['repeat_rule']]);
 
        $this->assertDatabaseHas('tasks', ['name' => '朝の開店準備']);
        $this->assertDatabaseHas('task_repeat_rules', ['pattern' => 'daily', 'non_working_day_behavior' => 'skip']);
    }
 
    /**
     * Test task update restrictions for general staff.
     */
    public function test_task_update_permissions_as_staff()
    {
        [$org, $admin] = $this->setupTenant('a', 'admin');
        
        // Create staff
        $staff = User::create([
            'email' => 'staff@example.com',
            'login_id' => 'staffuser',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($staff->id, ['role' => 'staff']);
 
        // Admin creates a task
        $task = Task::create([
            'organization_id' => $org->id,
            'name' => '元のタスク名',
            'status' => 'todo',
            'actual_hours' => 0.0,
        ]);
 
        // Staff attempts to update name -> must be ignored (remains '元のタスク名')
        // Staff can update status and actual_hours
        $response = $this->actingAsUser($staff, $org)->putJson("/api/tasks/{$task->id}", [
            'name' => 'スタッフによる改ざん名',
            'status' => 'doing',
            'actual_hours' => 2.5,
        ]);
 
        $response->assertStatus(200);
        $task->refresh();
        $this->assertEquals('元のタスク名', $task->name); // Name not changed
        $this->assertEquals('doing', $task->status);      // Status updated
        $this->assertEquals(2.5, $task->actual_hours);    // Actual hours updated
    }
 
    /**
     * Test task update permissions for admin.
     */
    public function test_task_update_permissions_as_admin()
    {
        [$org, $admin] = $this->setupTenant('a', 'admin');
 
        // Admin creates a task
        $task = Task::create([
            'organization_id' => $org->id,
            'name' => '元のタスク名',
            'status' => 'todo',
            'actual_hours' => 0.0,
        ]);
 
        // Admin attempts to update name -> succeeds
        $response = $this->actingAsUser($admin, $org)->putJson("/api/tasks/{$task->id}", [
            'name' => '管理者による正しい変更名',
        ]);
        $response->assertStatus(200);
        $task->refresh();
        $this->assertEquals('管理者による正しい変更名', $task->name);
    }
 
    /**
     * Test task comment postings with metadata.
     */
    public function test_task_comment_postings()
    {
        [$org, $admin] = $this->setupTenant('a', 'admin');
 
        $task = Task::create([
            'organization_id' => $org->id,
            'name' => 'テストタスク',
        ]);
 
        $response = $this->actingAsUser($admin, $org)->postJson("/api/tasks/{$task->id}/comments", [
            'content' => 'ダクト破損部分の養生を行いました。',
            'importance' => 'high',
            'type' => 'handover',
        ]);
 
        $response->assertStatus(201)
            ->assertJsonPath('data.importance', 'high')
            ->assertJsonPath('data.type', 'handover');
 
        $this->assertDatabaseHas('task_comments', [
            'task_id' => $task->id,
            'importance' => 'high',
            'type' => 'handover',
        ]);
    }
 
    /**
     * Test bulk clean up comments by admin with strict tenant isolation.
     */
    public function test_bulk_clean_up_comments_by_admin()
    {
        [$orgA, $adminA] = $this->setupTenant('a', 'admin');
        [$orgB, $adminB] = $this->setupTenant('b', 'admin');
 
        // Setup tasks
        $taskA = Task::create(['organization_id' => $orgA->id, 'name' => 'タスクA']);
        $taskB = Task::create(['organization_id' => $orgB->id, 'name' => 'タスクB']);
 
        // 1. Create target comment in Tenant A (old memo, low importance)
        $commentOldA = TaskComment::create([
            'organization_id' => $orgA->id,
            'task_id' => $taskA->id,
            'user_id' => $adminA->id,
            'content' => '古いメモA',
            'importance' => 'low',
            'type' => 'memo',
        ]);
        // Modify created_at to 40 days ago
        $commentOldA->created_at = Carbon::now()->subDays(40);
        $commentOldA->save();
 
        // 2. Create non-target comment in Tenant A (new memo, low importance)
        $commentNewA = TaskComment::create([
            'organization_id' => $orgA->id,
            'task_id' => $taskA->id,
            'user_id' => $adminA->id,
            'content' => '新しいメモA',
            'importance' => 'low',
            'type' => 'memo',
        ]);
 
        // 3. Create non-target comment in Tenant A (old handover, high importance)
        $commentOldImportantA = TaskComment::create([
            'organization_id' => $orgA->id,
            'task_id' => $taskA->id,
            'user_id' => $adminA->id,
            'content' => '古い申し送りA',
            'importance' => 'high',
            'type' => 'handover',
        ]);
        $commentOldImportantA->created_at = Carbon::now()->subDays(40);
        $commentOldImportantA->save();
 
        // 4. Create target comment in Tenant B (old memo, low importance)
        // This is under Tenant B, so Admin A should NOT delete it!
        $commentOldB = TaskComment::create([
            'organization_id' => $orgB->id,
            'task_id' => $taskB->id,
            'user_id' => $adminB->id,
            'content' => '古いメモB',
            'importance' => 'low',
            'type' => 'memo',
        ]);
        $commentOldB->created_at = Carbon::now()->subDays(40);
        $commentOldB->save();
 
        // Run clean up as Admin A
        $response = $this->actingAsUser($adminA, $orgA)->deleteJson('/api/comments/cleanup', [
            'before_days' => 30,
            'types' => ['memo'],
            'importances' => ['low'],
        ]);
 
        $response->assertStatus(200)
            ->assertJsonPath('message', '条件に合致するコメント 1 件を一括削除しました。');
 
        // Verify database states
        $this->assertDatabaseMissing('task_comments', ['id' => $commentOldA->id]); // Target deleted
        $this->assertDatabaseHas('task_comments', ['id' => $commentNewA->id]);     // Too new, kept
        $this->assertDatabaseHas('task_comments', ['id' => $commentOldImportantA->id]); // Wrong type/importance, kept
        $this->assertDatabaseHas('task_comments', ['id' => $commentOldB->id]);     // Belongs to Tenant B, MUST be kept
    }
}
