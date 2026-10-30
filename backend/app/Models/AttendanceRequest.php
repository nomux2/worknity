<?php

namespace App\Models;

use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceRequest extends Model
{
    use HasFactory, Multitenant;

    protected $fillable = [
        'organization_id',
        'user_id',
        'type', // 'correction', 'leave'
        'status', // 'pending', 'approved', 'rejected'
        'target_date',
        'requested_clock_in',
        'requested_clock_out',
        'requested_break_minutes',
        'leave_type', // 'paid', 'unpaid', 'special'
        'reason',
        'approved_by',
        'approved_at',
    ];

    protected $casts = [
        'target_date' => 'date:Y-m-d',
        'requested_clock_in' => 'datetime',
        'requested_clock_out' => 'datetime',
        'approved_at' => 'datetime',
        'requested_break_minutes' => 'integer',
    ];

    protected $appends = [
        'user_login_id',
        'approver_login_id',
        'formatted_requested_clock_in',
        'formatted_requested_clock_out',
    ];

    /**
     * User who made the request.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Organization relation.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Approver relation.
     */
    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    /**
     * Accessor to get user login_id.
     */
    public function getUserLoginIdAttribute(): ?string
    {
        return $this->user ? $this->user->login_id : null;
    }

    /**
     * Accessor to get approver login_id.
     */
    public function getApproverLoginIdAttribute(): ?string
    {
        return $this->approver ? $this->approver->login_id : null;
    }

    /**
     * Formatted requested clock in.
     */
    public function getFormattedRequestedClockInAttribute(): ?string
    {
        return $this->requested_clock_in ? $this->requested_clock_in->format('H:i') : null;
    }

    /**
     * Formatted requested clock out.
     */
    public function getFormattedRequestedClockOutAttribute(): ?string
    {
        return $this->requested_clock_out ? $this->requested_clock_out->format('H:i') : null;
    }

    /**
     * Get the related report (from approval flow).
     */
    public function report(): \Illuminate\Database\Eloquent\Relations\MorphOne
    {
        return $this->morphOne('App\Models\Report', 'approvable');
    }

    /**
     * Handle workflow approval event.
     */
    public function onWorkflowApproved(Report $report): void
    {
        $lastApproval = $report->approvals()->latest()->first();
        $this->update([
            'status' => 'approved',
            'approved_by' => $lastApproval ? $lastApproval->user_id : null,
            'approved_at' => now(),
        ]);
    }

    /**
     * Handle workflow rejection event.
     */
    public function onWorkflowRejected(Report $report): void
    {
        $lastApproval = $report->approvals()->latest()->first();
        $this->update([
            'status' => 'rejected',
            'approved_by' => $lastApproval ? $lastApproval->user_id : null,
            'approved_at' => now(),
        ]);
    }
}
