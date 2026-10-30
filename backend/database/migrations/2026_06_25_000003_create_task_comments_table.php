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
        Schema::create('task_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->onDelete('cascade');
            $table->foreignId('task_id')->constrained('tasks')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->text('content');
            $table->string('importance', 20)->default('medium'); // low, medium, high
            $table->string('type', 50)->default('communication'); // communication, handover, log, memo
            $table->foreignId('related_task_id')->nullable()->constrained('tasks')->onDelete('set null');
            $table->timestamps();
 
            // Indexes
            $table->index('organization_id');
            // Index for order by created_at in specific task comments
            $table->index(['organization_id', 'task_id', 'created_at'], 'idx_comments_org_task_created');
            // Index for cleanup query optimization
            $table->index(['organization_id', 'type', 'importance', 'created_at'], 'idx_comments_cleanup');
        });
    }
 
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('task_comments');
    }
};
