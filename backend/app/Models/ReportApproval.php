<?php

namespace App\Models;

use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ReportApproval extends Model
{
    use HasFactory, Multitenant;

    protected $fillable = [
        'organization_id',
        'report_id',
        'step_number',
        'user_id',
        'action', // approved, rejected
        'comment',
    ];

    /**
     * Get the associated report.
     */
    public function report(): BelongsTo
    {
        return $this->belongsTo(Report::class);
    }

    /**
     * Get the user who performed this action.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
