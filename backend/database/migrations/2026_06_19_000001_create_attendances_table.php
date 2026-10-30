<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('attendances', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->onDelete('cascade')->onUpdate('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade')->onUpdate('cascade');
            $table->date('work_date');
            $table->dateTime('clock_in')->nullable();
            $table->dateTime('clock_out')->nullable();
            $table->integer('break_minutes')->default(0);
            $table->string('status', 50)->default('working'); // 'working', 'completed', 'absent', 'leave'
            $table->timestamps();

            // Unique constraint to prevent duplicate attendance on the same day for a user
            $table->unique(['organization_id', 'user_id', 'work_date'], 'uk_attendances_org_user_date');
            
            // Indexes
            $table->index('organization_id', 'idx_attendances_organization_id');
            $table->index(['organization_id', 'work_date'], 'idx_attendances_org_date');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attendances');
    }
};
