<?php
 
namespace App\Http\Controllers;
 
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
 
class ProjectController extends Controller
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
     * Get list of projects scoped to active organization.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Project::query();
 
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
 
        $projects = $query->orderBy('created_at', 'desc')->get();
 
        return response()->json([
            'data' => $projects
        ]);
    }
 
    /**
     * Get a specific project.
     */
    public function show(string $id): JsonResponse
    {
        // Finds by id with global multitenant scope active, ensuring 404 on access to other organization
        $project = Project::findOrFail($id);
 
        return response()->json([
            'data' => $project
        ]);
    }
 
    /**
     * Create a new project.
     */
    public function store(Request $request): JsonResponse
    {
        if (!$this->isAdmin()) {
            return response()->json(['message' => 'この操作を行う権限がありません。'], 403);
        }
 
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'description' => 'nullable|string',
            'status' => 'nullable|string|in:planned,active,completed,suspended',
            'start_date' => 'nullable|date|date_format:Y-m-d',
            'end_date' => 'nullable|date|date_format:Y-m-d|after_or_equal:start_date',
            'budget_hours' => 'nullable|integer|min:0',
        ]);
 
        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }
 
        $project = Project::create([
            'name' => $request->name,
            'description' => $request->description,
            'status' => $request->input('status', 'planned'),
            'start_date' => $request->start_date,
            'end_date' => $request->end_date,
            'budget_hours' => $request->budget_hours,
        ]);
 
        return response()->json([
            'message' => 'プロジェクトを作成しました。',
            'data' => $project
        ], 201);
    }
 
    /**
     * Update a project.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        if (!$this->isAdmin()) {
            return response()->json(['message' => 'この操作を行う権限がありません。'], 403);
        }
 
        $project = Project::findOrFail($id);
 
        $validator = Validator::make($request->all(), [
            'name' => 'nullable|string|max:100',
            'description' => 'nullable|string',
            'status' => 'nullable|string|in:planned,active,completed,suspended',
            'start_date' => 'nullable|date|date_format:Y-m-d',
            'end_date' => 'nullable|date|date_format:Y-m-d|after_or_equal:start_date',
            'budget_hours' => 'nullable|integer|min:0',
        ]);
 
        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }
 
        $project->update($request->only([
            'name',
            'description',
            'status',
            'start_date',
            'end_date',
            'budget_hours',
        ]));
 
        return response()->json([
            'message' => 'プロジェクト情報を更新しました。',
            'data' => $project
        ]);
    }
 
    /**
     * Delete a project.
     */
    public function destroy(string $id): JsonResponse
    {
        if (!$this->isAdmin()) {
            return response()->json(['message' => 'この操作を行う権限がありません。'], 403);
        }
 
        $project = Project::findOrFail($id);
 
        // Notice: tasks project_id will be set to NULL automatically due to onDelete('set null') migration setup
        $project->delete();
 
        return response()->json([
            'message' => 'プロジェクトを削除しました。紐づくタスクの連携を解除しました。'
        ]);
    }
}
