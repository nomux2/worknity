<?php

namespace App\Models;

use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportApprovalRoute extends Model
{
    use HasFactory, Multitenant;

    protected $fillable = [
        'organization_id',
        'report_template_id',
        'step_number',
        'approver_type',
        'approval_class_id',
        'approver_user_id',
    ];

    /**
     * Get the template this route belongs to.
     */
    public function template(): BelongsTo
    {
        return $this->belongsTo(ReportTemplate::class, 'report_template_id');
    }

    /**
     * Get the associated approval class.
     */
    public function approvalClass(): BelongsTo
    {
        return $this->belongsTo(ApprovalClass::class, 'approval_class_id');
    }

    /**
     * Get the designated approver user.
     */
    public function approverUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approver_user_id');
    }
}
