<?php
 
namespace App\Http\Controllers;
 
use App\Models\Task;
use App\Models\TaskRepeatRule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
 
class TaskController extends Controller
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
     * Get list of tasks scoped to active organization.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Task::query()->with('repeatRule');
 
        // Filter by project_id. Support explicit "project_id = 0" for project-less tasks.
        if ($request->has('project_id')) {
            $projectId = $request->project_id;
            if ($projectId === '0' || $projectId === 0 || $projectId === null) {
                $query->whereNull('project_id');
            } else {
                $query->where('project_id', $projectId);
            }
        }
 
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
 
        $tasks = $query->orderBy('created_at', 'desc')->get();
 
        return response()->json([
            'data' => $tasks
        ]);
    }
 
    /**
     * Get specific task.
     */
    public function show(string $id): JsonResponse
    {
        $task = Task::with('repeatRule')->findOrFail($id);
 
        return response()->json([
            'data' => $task
        ]);
    }
 
    /**
     * Create a new task (Admin only).
     */
    public function store(Request $request): JsonResponse
    {
        if (!$this->isAdmin()) {
            return response()->json(['message' => 'この操作を行う権限がありません。'], 403);
        }
 
        $validator = Validator::make($request->all(), [
            'project_id' => 'nullable|integer|exists:projects,id',
            'name' => 'required|string|max:100',
            'description' => 'nullable|string',
            'assignee_id' => 'nullable|integer|exists:users,id',
            'status' => 'nullable|string|in:todo,doing,done',
            'due_date' => 'nullable|date|date_format:Y-m-d',
            'planned_hours' => 'nullable|numeric|min:0',
            'actual_hours' => 'nullable|numeric|min:0',
            'repeat_rule' => 'nullable|array',
            'repeat_rule.pattern' => 'required_with:repeat_rule|string|in:daily,weekly,biweekly,monthly,first_day_of_month,last_day_of_month',
            'repeat_rule.details' => 'nullable|array',
            'repeat_rule.non_working_day_behavior' => 'required_with:repeat_rule|string|in:as_is,next_working_day,prev_working_day,skip',
        ]);
 
        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }
 
        try {
            $task = DB::transaction(function () use ($request) {
                // 1. Create Task
                $task = Task::create([
                    'project_id' => $request->project_id,
                    'name' => $request->name,
                    'description' => $request->description,
                    'assignee_id' => $request->assignee_id,
                    'status' => $request->input('status', 'todo'),
                    'due_date' => $request->due_date,
                    'planned_hours' => $request->planned_hours,
                    'actual_hours' => $request->input('actual_hours', 0),
                ]);
 
                // 2. Create Repeat Rule if specified
                if ($request->has('repeat_rule')) {
                    $ruleData = $request->repeat_rule;
                    TaskRepeatRule::create([
                        'task_id' => $task->id,
                        'pattern' => $ruleData['pattern'],
                        'details' => $ruleData['details'] ?? null,
                        'non_working_day_behavior' => $ruleData['non_working_day_behavior'],
                    ]);
                }
 
                return $task;
            });
 
            return response()->json([
                'message' => 'タスクを作成しました。',
                'data' => $task->load('repeatRule')
            ], 201);
 
        } catch (\Exception $e) {
            return response()->json(['message' => 'タスクの作成に失敗しました。'], 500);
        }
    }
 
    /**
     * Update a task.
     */
    public function update(Request $request, string $id): JsonResponse
    {
        $task = Task::findOrFail($id);
        $isAdmin = $this->isAdmin();
 
        // Validation rules vary based on admin privileges
        if ($isAdmin) {
            $rules = [
                'project_id' => 'nullable|integer|exists:projects,id',
                'name' => 'nullable|string|max:100',
                'description' => 'nullable|string',
                'assignee_id' => 'nullable|integer|exists:users,id',
                'status' => 'nullable|string|in:todo,doing,done',
                'due_date' => 'nullable|date|date_format:Y-m-d',
                'planned_hours' => 'nullable|numeric|min:0',
                'actual_hours' => 'nullable|numeric|min:0',
                'repeat_rule' => 'nullable|array',
                'repeat_rule.pattern' => 'required_with:repeat_rule|string|in:daily,weekly,biweekly,monthly,first_day_of_month,last_day_of_month',
                'repeat_rule.details' => 'nullable|array',
                'repeat_rule.non_working_day_behavior' => 'required_with:repeat_rule|string|in:as_is,next_working_day,prev_working_day,skip',
            ];
        } else {
            // General staff can only update status and actual_hours
            $rules = [
                'status' => 'nullable|string|in:todo,doing,done',
                'actual_hours' => 'nullable|numeric|min:0',
            ];
        }
 
        $validator = Validator::make($request->all(), $rules);
 
        if ($validator->fails()) {
            return response()->json([
                'message' => '入力内容に不備があります。',
                'errors' => $validator->errors()
            ], 422);
        }
 
        try {
            DB::transaction(function () use ($request, $task, $isAdmin) {
                if ($isAdmin) {
                    $task->update($request->only([
                        'project_id', 'name', 'description', 'assignee_id', 'status', 'due_date', 'planned_hours', 'actual_hours'
                    ]));
 
                    // Update/Create/Delete repeat rule if admin modified it
                    if ($request->has('repeat_rule')) {
                        $ruleData = $request->repeat_rule;
                        $task->repeatRule()->updateOrCreate(
                            ['task_id' => $task->id],
                            [
                                'pattern' => $ruleData['pattern'],
                                'details' => $ruleData['details'] ?? null,
                                'non_working_day_behavior' => $ruleData['non_working_day_behavior'],
                            ]
                        );
                    }
                } else {
                    // Staff update
                    $task->update($request->only(['status', 'actual_hours']));
                }
            });
 
            return response()->json([
                'message' => 'タスクを更新しました。',
                'data' => $task->load('repeatRule')
            ]);
 
        } catch (\Exception $e) {
            return response()->json(['message' => 'タスクの更新に失敗しました。'], 500);
        }
    }
 
    /**
     * Delete a task (Admin only).
     */
    public function destroy(string $id): JsonResponse
    {
        if (!$this->isAdmin()) {
            return response()->json(['message' => 'この操作を行う権限がありません。'], 403);
        }
 
        $task = Task::findOrFail($id);
        $task->delete();
 
        return response()->json([
            'message' => 'タスクを削除しました。'
        ]);
    }
}
