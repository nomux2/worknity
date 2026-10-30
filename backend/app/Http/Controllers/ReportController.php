<?php

namespace App\Http\Controllers;

use App\Models\Report;
use App\Models\ReportApproval;
use App\Models\ReportTemplate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ReportController extends Controller
{
    /**
     * Get list of reports.
     */
    public function index(Request $request): JsonResponse
    {
        $userId = Auth::id();
        $tab = $request->input('tab', 'my'); // 'my' (マイ申請) or 'pending' (承認待ち)

        $query = Report::with(['template', 'user']);

        if ($tab === 'pending') {
            // 自分が承認できる「承認待ち」申請を取得
            // 自分が属する承認クラスのID一覧
            $classIds = Auth::user()->approvalClasses()->pluck('approval_classes.id')->toArray();

            $query->where('reports.status', 'pending')
                  ->whereHas('template.routes', function ($q) use ($userId, $classIds) {
                      $q->whereColumn('step_number', 'reports.current_step')
                        ->where(function ($sub) use ($userId, $classIds) {
                            $sub->where(function ($c) use ($classIds) {
                                $c->where('approver_type', 'class')
                                  ->whereIn('approval_class_id', $classIds);
                            })->orWhere(function ($u) use ($userId) {
                                $u->where('approver_type', 'user')
                                  ->where('approver_user_id', $userId);
                            });
                        });
                  });
        } else {
            // マイ申請
            $query->where('reports.user_id', $userId);
        }

        $perPage = $request->integer('per_page', 50);
        $reports = $query->orderBy('created_at', 'desc')->paginate($perPage);

        return response()->json([
            'data' => $reports->items(),
            'meta' => [
                'current_page' => $reports->currentPage(),
                'last_page' => $reports->lastPage(),
                'per_page' => $reports->perPage(),
                'total' => $reports->total()
            ]
        ]);
    }

    /**
     * Store a new report (manual submission).
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'report_template_id' => 'required|exists:report_templates,id',
            'status' => 'required|string|in:draft,pending',
            'attributes' => 'required|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $validator->errors()
            ], 422);
        }

        $template = ReportTemplate::findOrFail($request->report_template_id);

        // 簡単な必須項目バリデーション (JSON fields定義に基づく簡易チェック)
        $attributes = $request->input('attributes');
        $errors = [];
        foreach ($template->fields as $field) {
            $fieldName = $field['name'] ?? '';
            $required = $field['required'] ?? false;
            // 提出ステップのチェック (Step1の時のみ必須とするなど、段階的入力用)
            $step = $field['step'] ?? 1;

            if ($request->input('status') === 'pending' && $step == 1 && $required && empty($attributes[$fieldName])) {
                $errors[$fieldName] = ["{$field['label']}は必須項目です。"];
            }
        }

        if (!empty($errors)) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $errors
            ], 422);
        }

        $report = Report::create([
            'report_template_id' => $template->id,
            'user_id' => Auth::id(),
            'status' => $request->input('status'),
            'current_step' => 1,
            'attributes' => $attributes,
        ]);

        return response()->json(['data' => $report], 201);
    }

    /**
     * Display the specified report.
     */
    public function show($id): JsonResponse
    {
        // 外部リレーション、特に履歴と紐づくポリモーフィックモデルも同時にロード
        $report = Report::with(['template.routes.approvalClass', 'template.routes.approverUser', 'user', 'approvals.user', 'approvable'])->findOrFail($id);
        
        // 開発者・承認者向けのポリモーフィック元データの追加ロード
        // (フロントエンドでプレビュー表示する際に attributes に加えて元データモデルオブジェクトを返す)
        $approvableData = null;
        if ($report->approvable) {
            // 例: PurchaseOrder の場合は明細も一緒に返す
            if (method_exists($report->approvable, 'load')) {
                if ($report->approvable_type === 'App\Models\PurchaseOrder') {
                    $approvableData = $report->approvable->load('items.stock', 'partner');
                } else {
                    $approvableData = $report->approvable;
                }
            } else {
                $approvableData = $report->approvable;
            }
        }

        return response()->json([
            'data' => $report,
            'approvable_data' => $approvableData
        ]);
    }

    /**
     * Update the specified report.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $report = Report::findOrFail($id);

        // 下書き (draft) または 却下差し戻し (rejected) 状態のみ編集を許可
        if (!in_all($report->status, ['draft', 'rejected'])) {
            return response()->json(['message' => 'Cannot update report in current status.'], 400);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|string|in:draft,pending',
            'attributes' => 'required|array',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $validator->errors()
            ], 422);
        }

        $template = $report->template;
        $attributes = $request->input('attributes');
        
        // バリデーション
        $errors = [];
        foreach ($template->fields as $field) {
            $fieldName = $field['name'] ?? '';
            $required = $field['required'] ?? false;
            $step = $field['step'] ?? 1;

            if ($request->input('status') === 'pending' && $step == 1 && $required && empty($attributes[$fieldName])) {
                $errors[$fieldName] = ["{$field['label']}は必須項目です。"];
            }
        }

        if (!empty($errors)) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $errors
            ], 422);
        }

        $report->update([
            'status' => $request->input('status'),
            'attributes' => $attributes,
            'current_step' => 1, // 再提出時はステップを最初に戻す
        ]);

        return response()->json(['data' => $report]);
    }

    /**
     * Approve the report.
     */
    public function approve(Request $request, $id): JsonResponse
    {
        $userId = Auth::id();
        
        $validator = Validator::make($request->all(), [
            'comment' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $validator->errors()
            ], 422);
        }

        // トランザクション & 悲観的ロックで二重承認を防止
        $result = DB::transaction(function () use ($id, $userId, $request) {
            $report = Report::lockForUpdate()->findOrFail($id);

            if ($report->status !== 'pending') {
                return ['status' => 'error', 'message' => 'Report is not in pending status.'];
            }

            // 承認権限があるか検証
            $route = $report->template->routes()
                ->where('step_number', $report->current_step)
                ->first();

            if (!$route) {
                return ['status' => 'error', 'message' => 'Approval route for current step not found.'];
            }

            $hasAuthority = false;
            if ($route->approver_type === 'user' && $route->approver_user_id == $userId) {
                $hasAuthority = true;
            } elseif ($route->approver_type === 'class') {
                $classIds = Auth::user()->approvalClasses()->pluck('approval_classes.id')->toArray();
                if (in_array($route->approval_class_id, $classIds)) {
                    $hasAuthority = true;
                }
            }

            if (!$hasAuthority) {
                return ['status' => 'error', 'message' => 'You do not have permission to approve this step.'];
            }

            // 履歴の作成
            ReportApproval::create([
                'report_id' => $report->id,
                'step_number' => $report->current_step,
                'user_id' => $userId,
                'action' => 'approved',
                'comment' => $request->input('comment'),
            ]);

            // 次のステップ判定
            if ($report->current_step >= $report->template->steps_count) {
                // 最終承認完了
                $report->status = 'approved'; // completedにマッピング
                $report->save();
            } else {
                // 次の承認者ステップへ
                $report->current_step += 1;
                $report->save();
            }

            return ['status' => 'success', 'data' => $report];
        });

        if ($result['status'] === 'error') {
            return response()->json(['message' => $result['message']], 400);
        }

        return response()->json(['data' => $result['data']]);
    }

    /**
     * Reject the report.
     */
    public function reject(Request $request, $id): JsonResponse
    {
        $userId = Auth::id();

        // 却下時は理由は必須とする
        $validator = Validator::make($request->all(), [
            'comment' => 'required|string|min:1',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $validator->errors()
            ], 422);
        }

        $result = DB::transaction(function () use ($id, $userId, $request) {
            $report = Report::lockForUpdate()->findOrFail($id);

            if ($report->status !== 'pending') {
                return ['status' => 'error', 'message' => 'Report is not in pending status.'];
            }

            // 承認権限があるか検証
            $route = $report->template->routes()
                ->where('step_number', $report->current_step)
                ->first();

            if (!$route) {
                return ['status' => 'error', 'message' => 'Approval route for current step not found.'];
            }

            $hasAuthority = false;
            if ($route->approver_type === 'user' && $route->approver_user_id == $userId) {
                $hasAuthority = true;
            } elseif ($route->approver_type === 'class') {
                $classIds = Auth::user()->approvalClasses()->pluck('approval_classes.id')->toArray();
                if (in_array($route->approval_class_id, $classIds)) {
                    $hasAuthority = true;
                }
            }

            if (!$hasAuthority) {
                return ['status' => 'error', 'message' => 'You do not have permission to reject this step.'];
            }

            // 履歴の作成
            ReportApproval::create([
                'report_id' => $report->id,
                'step_number' => $report->current_step,
                'user_id' => $userId,
                'action' => 'rejected',
                'comment' => $request->input('comment'),
            ]);

            // 却下・差し戻し
            $report->status = 'rejected';
            $report->save();

            return ['status' => 'success', 'data' => $report];
        });

        if ($result['status'] === 'error') {
            return response()->json(['message' => $result['message']], 400);
        }

        return response()->json(['data' => $result['data']]);
    }
}

// ヘルパー関数の定義
if (!function_exists('in_all')) {
    function in_all($value, array $array) {
        return in_array($value, $array);
    }
}
