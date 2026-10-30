<?php

namespace App\Http\Controllers;

use App\Models\ApprovalClass;
use App\Models\UserApprovalClass;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ApprovalClassController extends Controller
{
    /**
     * Get list of approval classes.
     */
    public function index(Request $request): JsonResponse
    {
        $classes = ApprovalClass::withCount('users')->orderBy('priority', 'desc')->get();
        return response()->json(['data' => $classes]);
    }

    /**
     * Store a new approval class.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'priority' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $validator->errors()
            ], 422);
        }

        $class = ApprovalClass::create($request->only(['name', 'priority']));
        return response()->json(['data' => $class], 201);
    }

    /**
     * Display the specified approval class.
     */
    public function show($id): JsonResponse
    {
        $class = ApprovalClass::with('users')->findOrFail($id);
        return response()->json(['data' => $class]);
    }

    /**
     * Update the specified approval class.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $class = ApprovalClass::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'priority' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $validator->errors()
            ], 422);
        }

        $class->update($request->only(['name', 'priority']));
        return response()->json(['data' => $class]);
    }

    /**
     * Remove the specified approval class.
     */
    public function destroy($id): JsonResponse
    {
        $class = ApprovalClass::findOrFail($id);
        $class->delete();
        return response()->json(['message' => 'Approval class deleted successfully']);
    }

    /**
     * Assign a user to the approval class.
     */
    public function assignUser(Request $request, $id): JsonResponse
    {
        $class = ApprovalClass::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $validator->errors()
            ], 422);
        }

        // 重複チェック
        $exists = UserApprovalClass::where('approval_class_id', $class->id)
            ->where('user_id', $request->user_id)
            ->exists();

        if ($exists) {
            return response()->json(['message' => 'User is already assigned to this class'], 400);
        }

        $assignment = UserApprovalClass::create([
            'user_id' => $request->user_id,
            'approval_class_id' => $class->id,
        ]);

        return response()->json(['data' => $assignment], 201);
    }

    /**
     * Remove a user from the approval class.
     */
    public function removeUser(Request $request, $id): JsonResponse
    {
        $class = ApprovalClass::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'user_id' => 'required|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $validator->errors()
            ], 422);
        }

        UserApprovalClass::where('approval_class_id', $class->id)
            ->where('user_id', $request->user_id)
            ->delete();

        return response()->json(['message' => 'User removed from approval class successfully']);
    }
}
