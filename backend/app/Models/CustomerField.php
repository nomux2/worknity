<?php

namespace App\Models;

use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CustomerField extends Model
{
    use HasFactory, Multitenant;

    protected $fillable = [
        'organization_id',
        'field_key',
        'field_name',
        'field_type',
        'options',
        'is_custom',
        'is_enabled',
        'is_searchable',
        'sort_order',
    ];

    protected $casts = [
        'options' => 'array',
        'is_custom' => 'boolean',
        'is_enabled' => 'boolean',
        'is_searchable' => 'boolean',
        'sort_order' => 'integer',
    ];

    /**
     * Get the organization this field belongs to.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
