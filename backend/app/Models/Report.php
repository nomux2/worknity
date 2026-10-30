<?php

namespace App\Models;

use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Report extends Model
{
    use HasFactory, Multitenant;

    protected $fillable = [
        'organization_id',
        'report_template_id',
        'user_id',
        'status',
        'current_step',
        'attributes',
        'approvable_type',
        'approvable_id',
    ];

    protected $casts = [
        'attributes' => 'array',
        'current_step' => 'integer',
    ];

    /**
     * Get the template this report belongs to.
     */
    public function template(): BelongsTo
    {
        return $this->belongsTo(ReportTemplate::class, 'report_template_id');
    }

    /**
     * Get the user who created/submitted this report.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the approval/rejection logs for this report.
     */
    public function approvals(): HasMany
    {
        return $this->hasMany(ReportApproval::class)->orderBy('created_at');
    }

    /**
     * Get the parent approvable model (polymorphic relation).
     */
    public function approvable(): MorphTo
    {
        return $this->morphTo();
    }
}
