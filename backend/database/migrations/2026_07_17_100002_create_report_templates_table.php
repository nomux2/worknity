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
        Schema::create('report_templates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->onDelete('cascade');
            $table->string('name', 100);
            $table->text('description')->nullable();
            $table->string('type', 50)->default('report'); // 'report' or 'application'
            $table->integer('steps_count')->default(1); // 1〜3
            $table->json('fields'); // フォーム項目スキーマ (JSON)
            $table->timestamps();

            $table->index(['organization_id', 'type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('report_templates');
    }
};
