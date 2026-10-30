<?php

namespace App\Models;

use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserApprovalClass extends Model
{
    use HasFactory, Multitenant;

    protected $table = 'user_approval_classes';

    protected $fillable = [
        'organization_id',
        'user_id',
        'approval_class_id',
    ];

    /**
     * Get the user.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the approval class.
     */
    public function approvalClass(): BelongsTo
    {
        return $this->belongsTo(ApprovalClass::class);
    }
}
