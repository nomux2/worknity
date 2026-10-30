<?php

namespace App\Services;

use App\Models\Report;
use App\Models\ReportTemplate;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;

class WorkflowService
{
    /**
     * Create and submit a workflow request (Report) polymorphicly linked to another model.
     *
     * @param Model $approvable
     * @param int $templateId
     * @param array $attributes
     * @return Report
     */
    public function createWorkflowRequest(Model $approvable, int $templateId, array $attributes): Report
    {
        // テンプレートの存在確認とステップ数の取得
        $template = ReportTemplate::findOrFail($templateId);

        // 申請を作成して提出 (pending) にする
        $report = new Report();
        $report->organization_id = $approvable->organization_id;
        $report->report_template_id = $template->id;
        $report->user_id = Auth::id() ?? $approvable->created_by ?? 1; // CLI/テスト用フォールバック
        $report->status = 'pending';
        $report->current_step = 1;
        $report->attributes = $attributes;
        
        // ポリモーフィック関連の設定
        $report->approvable_type = get_class($approvable);
        $report->approvable_id = $approvable->id;
        
        $report->save();

        return $report;
    }
}
