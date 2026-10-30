<?php

namespace App\Observers;

use App\Models\Report;

class ReportObserver
{
    /**
     * Handle the Report "updated" event.
     */
    public function updated(Report $report): void
    {
        // ステータスが変更されたかチェック
        if ($report->isDirty('status')) {
            $newStatus = $report->status;
            
            // ポリモーフィック関連先が存在する場合にステータス変更を通知
            if ($report->approvable) {
                $approvable = $report->approvable;

                if ($newStatus === 'approved') {
                    if (method_exists($approvable, 'onWorkflowApproved')) {
                        $approvable->onWorkflowApproved($report);
                    }
                } elseif ($newStatus === 'rejected') {
                    if (method_exists($approvable, 'onWorkflowRejected')) {
                        $approvable->onWorkflowRejected($report);
                    }
                }
            }
        }
    }
}
