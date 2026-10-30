<?php
 
namespace App\Http\Controllers;
 
use App\Models\Task;
use App\Models\TaskComment;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
 
class TaskCommentController extends Controller
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
     * Get comments belonging to a specific task.
     */
    public function index(string $taskId): JsonResponse
    {
        // Finds task with multitenant scope check (throws 404 if not found/other organization)
        $task = Task::findOrFail($taskId);
 
        $comments = $task->comments()->with('user:id,login_id')->orderBy('created_at', 'asc')->get();
 
        return response()->json([
            'data' => $comments
        ]);
    }
 
    /**
     * Post a comment on a specific task.
     */
    public function store(Request $request, string $taskId): JsonResponse
    {
        $task = Task::findOrFail($taskId);
 
        $validator = Validator::make($request->all(), [
            'content' => 'required|string|max:1000',
            'importance' => 'nullable|string|in:low,medium,high',
            'type' => 'nullable|string|in:communication,handover,log,memo',
            'related_task_id' => 'nullable|integer|exists:tasks,id',
        ]);
 
        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }
 
        // Create comment. Multitenant trait automatically sets active organization_id
        $comment = TaskComment::create([
            'task_id' => $task->id,
            'user_id' => auth()->id(),
            'content' => $request->content,
            'importance' => $request->input('importance', 'medium'),
            'type' => $request->input('type', 'communication'),
            'related_task_id' => $request->related_task_id,
        ]);
 
        return response()->json([
            'message' => 'コメントを投稿しました。',
            'data' => $comment->load('user:id,login_id')
        ], 201);
    }
 
    /**
     * Bulk clean up (delete) old comments under the tenant. (Admin only)
     */
    public function cleanup(Request $request): JsonResponse
    {
        if (!$this->isAdmin()) {
            return response()->json(['message' => 'この操作を行う権限がありません。'], 403);
        }
 
        $validator = Validator::make($request->all(), [
            'before_days' => 'required|integer|min:0',
            'types' => 'required|array',
            'types.*' => 'string|in:communication,handover,log,memo',
            'importances' => 'required|array',
            'importances.*' => 'string|in:low,medium,high',
        ]);
 
        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }
 
        $organizationId = auth()->payload()->get('organization_id');
        $beforeDate = Carbon::now()->subDays($request->before_days);
 
        // Build base query. Note: Multitenant trait applies global scope,
        // but explicitly binding organization_id provides absolute guard for bulk deletion.
        $deletedCount = TaskComment::where('organization_id', $organizationId)
            ->where('created_at', '<', $beforeDate)
            ->whereIn('type', $request->types)
            ->whereIn('importance', $request->importances)
            ->delete();
 
        return response()->json([
            'message' => "条件に合致するコメント {$deletedCount} 件を一括削除しました。"
        ]);
    }
}
