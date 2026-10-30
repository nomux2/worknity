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
        Schema::create('customer_fields', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->onDelete('cascade');
            $table->string('field_key', 50);
            $table->string('field_name', 100);
            $table->string('field_type', 20);
            $table->json('options')->nullable();
            $table->boolean('is_custom')->default(true);
            $table->boolean('is_enabled')->default(true);
            $table->boolean('is_searchable')->default(true);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->unique(['organization_id', 'field_key']);
            $table->index(['organization_id', 'sort_order']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('customer_fields');
    }
};
