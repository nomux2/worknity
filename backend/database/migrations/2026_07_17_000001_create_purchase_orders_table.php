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
        Schema::create('purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->foreignId('organization_id')->constrained('organizations')->onDelete('cascade');
            $table->foreignId('partner_id')->constrained('partners')->onDelete('cascade');
            // report_id is nullable (optional integration with approval workflow)
            // Note: report_id references reports table which is created elsewhere
            $table->unsignedBigInteger('report_id')->nullable();
            $table->string('order_number', 50);
            $table->date('order_date');
            $table->date('delivery_deadline')->nullable();
            $table->string('status', 20)->default('draft'); // draft, ordered, partially_received, completed, cancelled
            $table->foreignId('created_by')->constrained('users')->onDelete('cascade');
            $table->timestamps();

            // Unique constraint within the same organization
            $table->unique(['organization_id', 'order_number']);

            // Indexes for faster lookups and sorts
            $table->index(['organization_id', 'status']);
            $table->index(['organization_id', 'order_date']);
            $table->index(['organization_id', 'partner_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchase_orders');
    }
};
