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
        Schema::table('stocks', function (Blueprint $table) {
            $table->string('jan_code')->nullable()->after('attributes');
            $table->text('description')->nullable()->after('jan_code');
            $table->string('image_url')->nullable()->after('description');
            $table->integer('price')->nullable()->after('image_url');
            $table->string('brand_name')->nullable()->after('price');
            $table->string('category_name')->nullable()->after('brand_name');

            // Index for JAN code lookup
            $table->index(['organization_id', 'jan_code'], 'idx_stocks_org_jan');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stocks', function (Blueprint $table) {
            $table->dropIndex('idx_stocks_org_jan');
            $table->dropColumn([
                'jan_code',
                'description',
                'image_url',
                'price',
                'brand_name',
                'category_name'
            ]);
        });
    }
};
