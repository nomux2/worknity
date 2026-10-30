<?php
 
namespace App\Http\Controllers;
 
use App\Models\CalendarHoliday;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
 
class CalendarHolidayController extends Controller
{
    /**
     * Check if current user is an admin of the active organization.
     */
    private function isAdmin(): bool
    {
        $user = auth()->user();
        if (!$user) {
            return false;
        }
 
        $organizationId = auth()->payload()->get('organization_id');
 
        $activeOrg = $user->organizations()
            ->where('organization_id', $organizationId)
            ->wherePivot('role', 'admin')
            ->first();
 
        return (bool) $activeOrg;
    }
 
    /**
     * Get list of organization holidays.
     */
    public function index(): JsonResponse
    {
        $holidays = CalendarHoliday::orderBy('holiday_date', 'asc')->get();
        $organizationId = auth()->payload()->get('organization_id');
        $organization = \App\Models\Organization::find($organizationId);
        $workingDays = $organization ? $organization->working_days : '1,2,3,4,5';
 
        return response()->json([
            'data' => $holidays,
            'working_days' => $workingDays
        ]);
    }
 
    /**
     * Register a new holiday (Admin only).
     */
    public function store(Request $request): JsonResponse
    {
        if (!$this->isAdmin()) {
            return response()->json(['message' => 'この操作を行う権限がありません。'], 403);
        }
 
        $organizationId = auth()->payload()->get('organization_id');
 
        $validator = Validator::make($request->all(), [
            'holiday_date' => 'required|date|date_format:Y-m-d|unique:calendar_holidays,holiday_date,NULL,id,organization_id,' . $organizationId,
            'name' => 'required|string|max:100',
        ]);
 
        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }
 
        $holiday = CalendarHoliday::create([
            'holiday_date' => $request->holiday_date,
            'name' => $request->name,
        ]);
 
        return response()->json([
            'message' => '休日を設定しました。',
            'data' => $holiday
        ], 201);
    }
 
    /**
     * Remove a holiday (Admin only).
     */
    public function destroy(string $id): JsonResponse
    {
        if (!$this->isAdmin()) {
            return response()->json(['message' => 'この操作を行う権限がありません。'], 403);
        }
 
        $holiday = CalendarHoliday::findOrFail($id);
        $holiday->delete();
 
        return response()->json([
            'message' => '休日設定を削除しました。'
        ]);
    }
 
    /**
     * Update organization working days (Admin only).
     */
    public function updateWorkingDays(Request $request): JsonResponse
    {
        if (!$this->isAdmin()) {
            return response()->json(['message' => 'この操作を行う権限がありません。'], 403);
        }
 
        $validator = Validator::make($request->all(), [
            'working_days' => 'required|string|regex:/^[1-7](,[1-7])*$/|max:50',
        ]);
 
        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }
 
        $organizationId = auth()->payload()->get('organization_id');
        $organization = \App\Models\Organization::findOrFail($organizationId);
        
        $organization->update([
            'working_days' => $request->working_days,
        ]);
 
        return response()->json([
            'message' => '稼働曜日を更新しました。',
            'working_days' => $organization->working_days,
        ]);
    }
}
