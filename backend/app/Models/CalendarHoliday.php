<?php
 
namespace App\Models;
 
use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
 
class CalendarHoliday extends Model
{
    use HasFactory, Multitenant;
 
    protected $fillable = [
        'organization_id',
        'holiday_date',
        'name',
    ];
 
    protected $casts = [
        'holiday_date' => 'date:Y-m-d',
    ];
 
    /**
     * Organization relation.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }
}
