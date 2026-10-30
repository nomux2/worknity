<?php

namespace Tests\Feature;

use App\Models\Organization;
use App\Models\User;
use App\Models\Attendance;
use App\Models\AttendanceRequest;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use PHPOpenSourceSaver\JWTAuth\Facades\JWTAuth;
use Tests\TestCase;

class AttendanceTest extends TestCase
{
    use RefreshDatabase;

    protected function actingAsUser(User $user, Organization $org)
    {
        try {
            auth()->guard('api')->logout();
        } catch (\Exception $e) {
            // Ignore if guard is not booted or cannot logout
        }
        
        $token = JWTAuth::claims(['organization_id' => $org->id])->fromUser($user);
        return $this->withHeader('Authorization', 'Bearer ' . $token);
    }

    /**
     * Test clock-in and clock-out punch logic.
     */
    public function test_clock_in_and_clock_out_punch()
    {
        $org = Organization::create(['name' => 'テスト組織']);
        $user = User::create([
            'email' => 'staff@example.com',
            'login_id' => 'staff1',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($user->id, ['role' => 'staff']);

        // 1. Clock-in
        $response = $this->actingAsUser($user, $org)->postJson('/api/attendances/clock-in');
        $response->assertStatus(201);
        $this->assertEquals('working', $response->json('data.status'));
        $this->assertNotNull($response->json('data.clock_in'));
        
        // Ensure duplicate clock-in is blocked
        $responseDuplicate = $this->actingAsUser($user, $org)->postJson('/api/attendances/clock-in');
        $responseDuplicate->assertStatus(400);

        // 2. Clock-out (auto-break logic: less than 6 hours -> 0 min break)
        $responseOut = $this->actingAsUser($user, $org)->postJson('/api/attendances/clock-out');
        $responseOut->assertStatus(200);
        $this->assertEquals('completed', $responseOut->json('data.status'));
        $this->assertEquals(0, $responseOut->json('data.break_minutes'));
    }

    /**
     * Test attendance request creation and admin approval.
     */
    public function test_attendance_request_creation_and_approval()
    {
        $org = Organization::create(['name' => 'テスト組織']);
        
        $admin = User::create([
            'email' => 'admin@example.com',
            'login_id' => 'admin1',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($admin->id, ['role' => 'admin']);

        $staff = User::create([
            'email' => 'staff@example.com',
            'login_id' => 'staff1',
            'password' => Hash::make('password123'),
            'default_organization_id' => $org->id,
        ]);
        $org->users()->attach($staff->id, ['role' => 'staff']);

        // 1. Staff creates a correction request
        $responseReq = $this->actingAsUser($staff, $org)->postJson('/api/attendance-requests', [
            'type' => 'correction',
            'target_date' => '2026-06-18',
            'requested_clock_in' => '09:00',
            'requested_clock_out' => '18:00',
            'requested_break_minutes' => 60,
            'reason' => '打刻忘れのため修正お願いします。'
        ]);
        $responseReq->assertStatus(201);
        $requestId = $responseReq->json('data.id');

        // Verify request exists with status = pending
        $this->assertEquals('pending', $responseReq->json('data.status'));

        // 2. Staff attempts to approve it (should fail with 403)
        $responseStaffApprove = $this->actingAsUser($staff, $org)->putJson("/api/attendance-requests/{$requestId}/approve");
        $responseStaffApprove->assertStatus(403);

        // 3. Admin approves request
        $responseAdminApprove = $this->actingAsUser($admin, $org)->putJson("/api/attendance-requests/{$requestId}/approve");
        $responseAdminApprove->assertStatus(200);
        $this->assertEquals('approved', $responseAdminApprove->json('data.status'));

        // Verify attendance record was automatically generated for that staff
        $attendance = Attendance::where('user_id', $staff->id)
            ->where('work_date', '2026-06-18')
            ->first();
        
        $this->assertNotNull($attendance);
        $this->assertEquals('completed', $attendance->status);
        $this->assertEquals(60, $attendance->break_minutes);
        $this->assertStringContainsString('09:00:00', $attendance->clock_in);
        $this->assertStringContainsString('18:00:00', $attendance->clock_out);
    }

    /**
     * Test multi-tenant isolation.
     */
    public function test_multi_tenant_attendance_isolation()
    {
        // Setup Tenant A
        $orgA = Organization::create(['name' => '組織A']);
        $userA = User::create([
            'email' => 'userA@example.com',
            'login_id' => 'usera',
            'password' => Hash::make('password123'),
            'default_organization_id' => $orgA->id,
        ]);
        $orgA->users()->attach($userA->id, ['role' => 'admin']);

        // Create Attendance in Org A
        $attA = Attendance::create([
            'organization_id' => $orgA->id,
            'user_id' => $userA->id,
            'work_date' => '2026-06-18',
            'clock_in' => '2026-06-18 09:00:00',
            'clock_out' => '2026-06-18 18:00:00',
            'status' => 'completed'
        ]);

        // Setup Tenant B
        $orgB = Organization::create(['name' => '組織B']);
        $userB = User::create([
            'email' => 'userB@example.com',
            'login_id' => 'userb',
            'password' => Hash::make('password123'),
            'default_organization_id' => $orgB->id,
        ]);
        $orgB->users()->attach($userB->id, ['role' => 'admin']);

        // User B queries attendances (should NOT see User A's record)
        $response = $this->actingAsUser($userB, $orgB)->getJson('/api/attendances?month=2026-06');
        $response->assertStatus(200);
        $this->assertCount(0, $response->json('data'));
    }
}
