<?php

namespace App\Models;

use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

class ApprovalClass extends Model
{
    use HasFactory, Multitenant;

    protected $fillable = [
        'organization_id',
        'name',
        'priority',
    ];

    /**
     * Get users belonging to this approval class.
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_approval_classes');
    }
}
