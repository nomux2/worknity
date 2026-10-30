<?php

namespace App\Models;

use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ReportTemplate extends Model
{
    use HasFactory, Multitenant;

    protected $fillable = [
        'organization_id',
        'name',
        'description',
        'type',
        'steps_count',
        'fields',
    ];

    protected $casts = [
        'fields' => 'array',
    ];

    /**
     * Get the approval routes defined for this template.
     */
    public function routes(): HasMany
    {
        return $this->hasMany(ReportApprovalRoute::class)->orderBy('step_number');
    }
}
