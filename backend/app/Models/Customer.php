<?php

namespace App\Models;

use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Customer extends Model
{
    use HasFactory, Multitenant;

    protected $fillable = [
        'organization_id',
        'name',
        'kana',
        'email',
        'phone',
        'postal_code',
        'address',
        'attributes',
    ];

    protected $casts = [
        'attributes' => 'array',
    ];

    /**
     * Get the active organization this customer belongs to.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
