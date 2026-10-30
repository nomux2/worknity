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
        Schema::create('attendance_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->onDelete('cascade')->onUpdate('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade')->onUpdate('cascade');
            $table->string('type', 50); // 'correction', 'leave'
            $table->string('status', 50)->default('pending'); // 'pending', 'approved', 'rejected'
            $table->date('target_date');
            $table->dateTime('requested_clock_in')->nullable();
            $table->dateTime('requested_clock_out')->nullable();
            $table->integer('requested_break_minutes')->nullable();
            $table->string('leave_type', 50)->nullable(); // 'paid', 'unpaid', 'special'
            $table->text('reason')->nullable();
            $table->foreignId('approved_by')->nullable()->constrained('users')->onDelete('set null')->onUpdate('cascade');
            $table->dateTime('approved_at')->nullable();
            $table->timestamps();

            // Indexes
            $table->index('organization_id', 'idx_requests_organization_id');
            $table->index(['organization_id', 'status'], 'idx_requests_org_status');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('attendance_requests');
    }
};
