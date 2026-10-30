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
        Schema::create('report_approval_routes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->onDelete('cascade');
            $table->foreignId('report_template_id')->constrained('report_templates')->onDelete('cascade');
            $table->integer('step_number'); // 承認順序 (1〜3)
            $table->string('approver_type', 50)->default('class'); // 'class' or 'user'
            $table->foreignId('approval_class_id')->nullable()->constrained('approval_classes')->onDelete('set null');
            $table->foreignId('approver_user_id')->nullable()->constrained('users')->onDelete('set null');
            $table->timestamps();

            $table->unique(['organization_id', 'report_template_id', 'step_number'], 'uk_routes_step');
            $table->index(['organization_id', 'report_template_id'], 'idx_routes_org_template');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('report_approval_routes');
    }
};
