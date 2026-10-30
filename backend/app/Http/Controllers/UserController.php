<?php

namespace App\Http\Controllers;

use App\Models\Organization;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class UserController extends Controller
{
    /**
     * Get list of users belonging to the active organization.
     */
    public function index(): JsonResponse
    {
        $user = auth()->user();
        if (!$user) {
            return response()->json(['message' => 'ログインしていません。'], 401);
        }

        $organizationId = auth()->payload()->get('organization_id');

        // Ensure user is admin of active organization
        $activeOrg = $user->organizations()
            ->where('organization_id', $organizationId)
            ->wherePivot('role', 'admin')
            ->first();

        if (!$activeOrg) {
            return response()->json(['message' => 'この操作を行う権限がありません。'], 403);
        }

        $organization = Organization::find($organizationId);
        $users = $organization->users()->get()->map(function ($u) {
            return [
                'id' => $u->id,
                'email' => $u->email,
                'login_id' => $u->login_id,
                'role' => $u->pivot->role,
                'created_at' => $u->created_at,
            ];
        });

        return response()->json($users);
    }

    /**
     * Add a new staff member to the active organization.
     */
    public function store(Request $request): JsonResponse
    {
        $user = auth()->user();
        if (!$user) {
            return response()->json(['message' => 'ログインしていません。'], 401);
        }

        $organizationId = auth()->payload()->get('organization_id');

        // Ensure user is admin of active organization
        $activeOrg = $user->organizations()
            ->where('organization_id', $organizationId)
            ->wherePivot('role', 'admin')
            ->first();

        if (!$activeOrg) {
            return response()->json(['message' => 'この操作を行う権限がありません。'], 403);
        }

        $validator = Validator::make($request->all(), [
            'email' => 'required|email|max:255|unique:users,email',
            'login_id' => 'nullable|alpha_num|max:255|unique:users,login_id',
            'password' => 'required|string|min:8',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }

        try {
            $newUser = DB::transaction(function () use ($request, $organizationId) {
                // If login_id not provided, extract it from email
                $loginId = $request->login_id ?: explode('@', $request->email)[0];

                $user = User::create([
                    'email' => $request->email,
                    'login_id' => $loginId,
                    'password' => Hash::make($request->password),
                    'default_organization_id' => $organizationId,
                ]);

                $organization = Organization::find($organizationId);
                $organization->users()->attach($user->id, ['role' => 'staff']);

                return $user;
            });

            return response()->json([
                'id' => $newUser->id,
                'email' => $newUser->email,
                'role' => 'staff',
                'organization_id' => (int)$organizationId,
                'created_at' => $newUser->created_at,
            ], 201);

        } catch (\Exception $e) {
            return response()->json(['message' => 'スタッフ登録に失敗しました。' . $e->getMessage()], 500);
        }
    }
}
