<?php

namespace App\Models;

use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockLog extends Model
{
    use HasFactory, Multitenant;

    protected $fillable = [
        'organization_id',
        'stock_id',
        'user_id',
        'operation',
        'prior_quantity',
        'new_quantity',
    ];

    /**
     * Get the organization this log belongs to.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Get the stock item associated with this log.
     */
    public function stock(): BelongsTo
    {
        return $this->belongsTo(Stock::class);
    }

    /**
     * Get the user who executed the operation.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
