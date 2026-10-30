<?php

namespace App\Http\Controllers;

use App\Models\ReportTemplate;
use App\Models\ReportApprovalRoute;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ReportTemplateController extends Controller
{
    /**
     * Get list of report templates.
     */
    public function index(Request $request): JsonResponse
    {
        $templates = ReportTemplate::with('routes.approvalClass', 'routes.approverUser')->get();
        return response()->json(['data' => $templates]);
    }

    /**
     * Store a new report template.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'description' => 'nullable|string',
            'type' => 'required|string|in:report,application',
            'steps_count' => 'required|integer|min:1|max:3',
            'fields' => 'required|array',
            'routes' => 'required|array|min:1',
            'routes.*.step_number' => 'required|integer|min:1|max:3',
            'routes.*.approver_type' => 'required|string|in:class,user',
            'routes.*.approval_class_id' => 'nullable|required_if:routes.*.approver_type,class|exists:approval_classes,id',
            'routes.*.approver_user_id' => 'nullable|required_if:routes.*.approver_type,user|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $validator->errors()
            ], 422);
        }

        $template = DB::transaction(function () use ($request) {
            $template = ReportTemplate::create($request->only([
                'name', 'description', 'type', 'steps_count', 'fields'
            ]));

            foreach ($request->input('routes') as $routeData) {
                ReportApprovalRoute::create([
                    'report_template_id' => $template->id,
                    'step_number' => $routeData['step_number'],
                    'approver_type' => $routeData['approver_type'],
                    'approval_class_id' => $routeData['approval_class_id'] ?? null,
                    'approver_user_id' => $routeData['approver_user_id'] ?? null,
                ]);
            }

            return $template;
        });

        return response()->json(['data' => $template->load('routes')], 211); // 201 Created or 200
    }

    /**
     * Display the specified template.
     */
    public function show($id): JsonResponse
    {
        $template = ReportTemplate::with('routes.approvalClass', 'routes.approverUser')->findOrFail($id);
        return response()->json(['data' => $template]);
    }

    /**
     * Update the specified template.
     */
    public function update(Request $request, $id): JsonResponse
    {
        $template = ReportTemplate::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'description' => 'nullable|string',
            'type' => 'required|string|in:report,application',
            'steps_count' => 'required|integer|min:1|max:3',
            'fields' => 'required|array',
            'routes' => 'required|array|min:1',
            'routes.*.step_number' => 'required|integer|min:1|max:3',
            'routes.*.approver_type' => 'required|string|in:class,user',
            'routes.*.approval_class_id' => 'nullable|required_if:routes.*.approver_type,class|exists:approval_classes,id',
            'routes.*.approver_user_id' => 'nullable|required_if:routes.*.approver_type,user|exists:users,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation error',
                'errors' => $validator->errors()
            ], 422);
        }

        DB::transaction(function () use ($request, $template) {
            $template->update($request->only([
                'name', 'description', 'type', 'steps_count', 'fields'
            ]));

            // 古いルート設定をクリアして再作成
            ReportApprovalRoute::where('report_template_id', $template->id)->delete();

            foreach ($request->input('routes') as $routeData) {
                ReportApprovalRoute::create([
                    'report_template_id' => $template->id,
                    'step_number' => $routeData['step_number'],
                    'approver_type' => $routeData['approver_type'],
                    'approval_class_id' => $routeData['approval_class_id'] ?? null,
                    'approver_user_id' => $routeData['approver_user_id'] ?? null,
                ]);
            }
        });

        return response()->json(['data' => $template->load('routes')]);
    }

    /**
     * Remove the specified template.
     */
    public function destroy($id): JsonResponse
    {
        $template = ReportTemplate::findOrFail($id);
        $template->delete();
        return response()->json(['message' => 'Template deleted successfully']);
    }
}
