<?php

namespace App\Models;

use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrderSetting extends Model
{
    use HasFactory, Multitenant;

    protected $table = 'order_settings';

    protected $fillable = [
        'organization_id',
        'require_approval',
        'approval_threshold',
        'report_template_id',
    ];

    protected $casts = [
        'require_approval' => 'boolean',
        'approval_threshold' => 'integer',
    ];

    /**
     * Get the associated report template.
     */
    public function reportTemplate(): BelongsTo
    {
        return $this->belongsTo(ReportTemplate::class, 'report_template_id');
    }
}
