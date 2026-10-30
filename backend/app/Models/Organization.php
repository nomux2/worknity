<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Organization extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'working_days',
        'addons',
    ];

    protected $casts = [
        'addons' => 'array',
    ];

    /**
     * Users belonging to this organization.
     */
    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class)
            ->withPivot('role')
            ->withTimestamps();
    }

    /**
     * Stocks belonging to this organization.
     */
    public function stocks(): HasMany
    {
        return $this->hasMany(Stock::class);
    }

    /**
     * Stock logs belonging to this organization.
     */
    public function stockLogs(): HasMany
    {
        return $this->hasMany(StockLog::class);
    }

    /**
     * Projects belonging to this organization.
     */
    public function projects(): HasMany
    {
        return $this->hasMany(Project::class);
    }

    /**
     * Tasks belonging to this organization.
     */
    public function tasks(): HasMany
    {
        return $this->hasMany(Task::class);
    }

    /**
     * Calendar holidays belonging to this organization.
     */
    public function calendarHolidays(): HasMany
    {
        return $this->hasMany(CalendarHoliday::class);
    }
}
