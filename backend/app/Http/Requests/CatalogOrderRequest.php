<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class CatalogOrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return auth()->check(); // Requires authenticated device/session
    }

    public function rules(): array
    {
        return [
            'items' => 'required|array|min:1',
            'items.*.id' => 'required|integer|exists:catalog_items,id',
            'items.*.quantity' => 'required|integer|min:1',
        ];
    }
}
