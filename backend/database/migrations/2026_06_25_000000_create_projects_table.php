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
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->onDelete('cascade');
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->string('status', 50)->default('planned'); // planned, active, completed, suspended
            $table->date('start_date')->nullable();
            $table->date('end_date')->nullable();
            $table->integer('budget_hours')->nullable();
            $table->timestamps();
 
            // Multi-tenant indexes
            $table->index('organization_id');
            $table->index(['organization_id', 'status']);
            $table->index(['organization_id', 'end_date']);
        });
    }
 
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('projects');
    }
};
