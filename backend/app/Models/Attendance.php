<?php

namespace App\Models;

use App\Traits\Multitenant;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Carbon\Carbon;

class Attendance extends Model
{
    use HasFactory, Multitenant;

    protected $fillable = [
        'organization_id',
        'user_id',
        'work_date',
        'clock_in',
        'clock_out',
        'break_minutes',
        'status', // 'working', 'completed', 'absent', 'leave'
    ];

    protected $casts = [
        'work_date' => 'date:Y-m-d',
        'clock_in' => 'datetime',
        'clock_out' => 'datetime',
        'break_minutes' => 'integer',
    ];

    protected $appends = [
        'work_minutes',
        'formatted_work_time',
        'formatted_clock_in',
        'formatted_clock_out',
    ];

    /**
     * User relation.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Organization relation.
     */
    public function organization(): BelongsTo
    {
        return $this->belongsTo(Organization::class);
    }

    /**
     * Calculate work minutes dynamically: (clock_out - clock_in) - break_minutes.
     */
    public function getWorkMinutesAttribute(): int
    {
        if (!$this->clock_in || !$this->clock_out) {
            return 0;
        }

        $in = Carbon::parse($this->clock_in);
        $out = Carbon::parse($this->clock_out);

        $totalDiff = $out->diffInMinutes($in);
        $workMinutes = $totalDiff - $this->break_minutes;

        return max(0, $workMinutes);
    }

    /**
     * Get formatted work time (e.g. "8時間30分" or "08:30"). Let's use "08:30" format for easy spreadsheet reading.
     */
    public function getFormattedWorkTimeAttribute(): string
    {
        $minutes = $this->work_minutes;
        if ($minutes <= 0) {
            return '-';
        }

        $hours = floor($minutes / 60);
        $remainingMinutes = $minutes % 60;

        return sprintf('%02d:%02d', $hours, $remainingMinutes);
    }

    /**
     * Format clock_in for UI display.
     */
    public function getFormattedClockInAttribute(): ?string
    {
        return $this->clock_in ? Carbon::parse($this->clock_in)->timezone('Asia/Tokyo')->format('H:i') : null;
    }

    /**
     * Format clock_out for UI display.
     */
    public function getFormattedClockOutAttribute(): ?string
    {
        return $this->clock_out ? Carbon::parse($this->clock_out)->timezone('Asia/Tokyo')->format('H:i') : null;
    }
}
