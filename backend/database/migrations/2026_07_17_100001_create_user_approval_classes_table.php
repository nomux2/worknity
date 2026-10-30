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
        Schema::create('user_approval_classes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->onDelete('cascade');
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('approval_class_id')->constrained('approval_classes')->onDelete('cascade');
            $table->timestamps();

            $table->unique(['organization_id', 'user_id', 'approval_class_id'], 'uk_user_app_class');
            $table->index(['organization_id', 'user_id'], 'idx_user_app_classes_org_user');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_approval_classes');
    }
};
