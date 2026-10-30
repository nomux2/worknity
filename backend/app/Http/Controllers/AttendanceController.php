<?php

namespace App\Http\Controllers;

use App\Models\Attendance;
use App\Models\AttendanceRequest;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class AttendanceController extends Controller
{
    /**
     * Check if the authenticated user is an administrator of the active organization.
     */
    private function isAdmin(): bool
    {
        $user = auth()->user();
        if (!$user) {
            return false;
        }

        try {
            $organizationId = auth()->payload()->get('organization_id');
            $activeOrg = $user->organizations()->find($organizationId);
            return $activeOrg && $activeOrg->pivot->role === 'admin';
        } catch (\Exception $e) {
            return false;
        }
    }

    /**
     * List attendance records for a given month.
     */
    public function index(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'month' => 'nullable|date_format:Y-m',
            'user_id' => 'nullable|integer|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'パラメータに不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        $monthStr = $request->query('month', Carbon::now('Asia/Tokyo')->format('Y-m'));
        $targetUserId = $request->query('user_id');

        $startOfMonth = Carbon::parse($monthStr . '-01', 'Asia/Tokyo')->startOfMonth();
        $endOfMonth = Carbon::parse($monthStr . '-01', 'Asia/Tokyo')->endOfMonth();

        $query = Attendance::with('user')
            ->whereBetween('work_date', [$startOfMonth->toDateString(), $endOfMonth->toDateString()]);

        if ($this->isAdmin()) {
            if ($targetUserId) {
                $query->where('user_id', $targetUserId);
            }
        } else {
            // Staff members can only view their own records
            $query->where('user_id', auth()->id());
        }

        $records = $query->orderBy('work_date', 'asc')->get();

        return response()->json([
            'data' => $records,
            'month' => $monthStr,
        ]);
    }

    /**
     * Clock in for the current day.
     */
    public function clockIn(): JsonResponse
    {
        $userId = auth()->id();
        $todayJst = Carbon::now('Asia/Tokyo');
        $workDate = $todayJst->toDateString();

        // Check if there is already an active or completed record for today
        $existing = Attendance::where('user_id', $userId)
            ->where('work_date', $workDate)
            ->first();

        if ($existing) {
            return response()->json([
                'message' => '本日は既に打刻（出勤）されています。'
            ], 400);
        }

        // Check if there is an unresolved overnight shift
        $unclosed = Attendance::where('user_id', $userId)
            ->where('status', 'working')
            ->first();
        
        if ($unclosed) {
            return response()->json([
                'message' => '前回の退勤打刻が行われていません。先に退勤するか、打刻修正申請を行ってください。',
                'unclosed_attendance' => $unclosed
            ], 400);
        }

        $attendance = Attendance::create([
            'user_id' => $userId,
            'work_date' => $workDate,
            'clock_in' => Carbon::now(),
            'break_minutes' => 0,
            'status' => 'working'
        ]);

        return response()->json([
            'message' => '出勤打刻を完了しました。',
            'data' => $attendance
        ], 201);
    }

    /**
     * Clock out for the current day.
     */
    public function clockOut(): JsonResponse
    {
        $userId = auth()->id();
        $nowJst = Carbon::now('Asia/Tokyo');
        $todayWorkDate = $nowJst->toDateString();

        // First find an open/working record (supports night shifts starting yesterday)
        $attendance = Attendance::where('user_id', $userId)
            ->where('status', 'working')
            ->orderBy('work_date', 'desc')
            ->first();

        // If no open shift found, try to find a completed one for today to overwrite or reject
        if (!$attendance) {
            $todayCompleted = Attendance::where('user_id', $userId)
                ->where('work_date', $todayWorkDate)
                ->where('status', 'completed')
                ->first();

            if ($todayCompleted) {
                return response()->json([
                    'message' => '本日は既に退勤打刻済みです。修正が必要な場合は打刻修正申請を行ってください。'
                ], 400);
            }

            return response()->json([
                'message' => '出勤打刻が見つかりません。先に出勤打刻をするか、打刻修正申請を行ってください。'
            ], 400);
        }

        // Calculate auto break minutes: 
        // 60 mins break if > 8 hrs, 45 mins break if > 6 hrs
        $clockIn = Carbon::parse($attendance->clock_in);
        $now = Carbon::now();
        $totalMinutes = $now->diffInMinutes($clockIn);
        
        $breakMinutes = 0;
        if ($totalMinutes > 480) {
            $breakMinutes = 60;
        } elseif ($totalMinutes > 360) {
            $breakMinutes = 45;
        }

        $attendance->update([
            'clock_out' => $now,
            'break_minutes' => $breakMinutes,
            'status' => 'completed'
        ]);

        return response()->json([
            'message' => '退勤打刻を完了しました。今日も一日お疲れ様でした！',
            'data' => $attendance
        ]);
    }

    /**
     * List attendance requests.
     */
    public function indexRequests(Request $request): JsonResponse
    {
        $query = AttendanceRequest::with('user', 'approver');

        if ($this->isAdmin()) {
            // Admin sees all requests in the organization
            if ($request->query('status')) {
                $query->where('status', $request->query('status'));
            }
        } else {
            // Staff member sees only their own requests
            $query->where('user_id', auth()->id());
        }

        $requests = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'data' => $requests
        ]);
    }

    /**
     * Submit a new attendance modification or leave request.
     */
    public function storeRequest(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'type' => 'required|in:correction,leave',
            'target_date' => 'required|date|after_or_equal:2020-01-01',
            'reason' => 'required|string|max:1000',
            
            // Correction fields
            'requested_clock_in' => 'nullable|required_if:type,correction|date_format:H:i',
            'requested_clock_out' => 'nullable|required_if:type,correction|date_format:H:i',
            'requested_break_minutes' => 'nullable|integer|min:0|max:1440',

            // Leave fields
            'leave_type' => 'nullable|required_if:type,leave|in:paid,unpaid,special',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        $userId = auth()->id();
        $targetDate = $request->input('target_date');

        // Check if there is already a pending request of the same type for this date
        $exists = AttendanceRequest::where('user_id', $userId)
            ->where('target_date', $targetDate)
            ->where('type', $request->input('type'))
            ->where('status', 'pending')
            ->first();

        if ($exists) {
            return response()->json([
                'message' => '指定された日付には、既に未承認の申請が存在します。'
            ], 400);
        }

        $reqData = [
            'user_id' => $userId,
            'type' => $request->input('type'),
            'status' => 'pending',
            'target_date' => $targetDate,
            'reason' => $request->input('reason'),
        ];

        if ($request->input('type') === 'correction') {
            $tDate = Carbon::parse($targetDate);
            $inTime = Carbon::parse($targetDate . ' ' . $request->input('requested_clock_in'));
            
            // If clock out time is early morning, it might be the next day
            $outTimeStr = $request->input('requested_clock_out');
            $outTime = Carbon::parse($targetDate . ' ' . $outTimeStr);
            if ($outTime->lt($inTime)) {
                $outTime->addDay(); // Handle night shift out time wrapping past midnight
            }

            $reqData['requested_clock_in'] = $inTime->toDateTimeString();
            $reqData['requested_clock_out'] = $outTime->toDateTimeString();
            $reqData['requested_break_minutes'] = $request->input('requested_break_minutes', 0);
        } else {
            $reqData['leave_type'] = $request->input('leave_type');
        }

        $attRequest = AttendanceRequest::create($reqData);

        return response()->json([
            'message' => '申請を送信しました。管理者の承認をお待ちください。',
            'data' => $attRequest
        ], 201);
    }

    /**
     * Approve an attendance request (Admin only).
     */
    public function approveRequest($id): JsonResponse
    {
        if (!$this->isAdmin()) {
            return response()->json(['message' => 'この操作を行う権限がありません。'], 403);
        }

        $attRequest = AttendanceRequest::find($id);

        if (!$attRequest) {
            return response()->json(['message' => '該当する申請が見つかりません。'], 404);
        }

        if ($attRequest->status !== 'pending') {
            return response()->json(['message' => 'この申請は既に処理済みです。'], 400);
        }

        try {
            DB::transaction(function () use ($attRequest) {
                // 1. Update request status
                $attRequest->update([
                    'status' => 'approved',
                    'approved_by' => auth()->id(),
                    'approved_at' => Carbon::now('Asia/Tokyo')->toDateTimeString(),
                ]);

                // 2. Find or create daily attendance record for the employee
                $attendance = Attendance::firstOrNew([
                    'organization_id' => $attRequest->organization_id,
                    'user_id' => $attRequest->user_id,
                    'work_date' => $attRequest->target_date->toDateString(),
                ]);

                if ($attRequest->type === 'correction') {
                    $attendance->clock_in = $attRequest->requested_clock_in;
                    $attendance->clock_out = $attRequest->requested_clock_out;
                    $attendance->break_minutes = $attRequest->requested_break_minutes ?? 0;
                    $attendance->status = 'completed';
                } elseif ($attRequest->type === 'leave') {
                    $attendance->clock_in = null;
                    $attendance->clock_out = null;
                    $attendance->break_minutes = 0;
                    $attendance->status = 'leave';
                }

                $attendance->save();
            });

            return response()->json([
                'message' => '申請を承認し、勤務状況に反映しました。',
                'data' => $attRequest
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'message' => '承認処理中にエラーが発生しました。' . $e->getMessage()
            ], 500);
        }
    }

    /**
     * Reject an attendance request (Admin only).
     */
    public function rejectRequest($id): JsonResponse
    {
        if (!$this->isAdmin()) {
            return response()->json(['message' => 'この操作を行う権限がありません。'], 403);
        }

        $attRequest = AttendanceRequest::find($id);

        if (!$attRequest) {
            return response()->json(['message' => '該当する申請が見つかりません。'], 404);
        }

        if ($attRequest->status !== 'pending') {
            return response()->json(['message' => 'この申請は既に処理済みです。'], 400);
        }

        $attRequest->update([
            'status' => 'rejected',
            'approved_by' => auth()->id(),
            'approved_at' => Carbon::now('Asia/Tokyo')->toDateTimeString(),
        ]);

        return response()->json([
            'message' => '申請を却下しました。',
            'data' => $attRequest
        ]);
    }
}
