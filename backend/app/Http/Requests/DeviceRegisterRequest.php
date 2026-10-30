<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DeviceRegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Require authenticated user (admin/staff)
        return auth()->check();
    }

    public function rules(): array
    {
        return [
            'name' => 'required|string|max:50',
            'device_code' => 'required|string|max:100|unique:devices,device_code',
        ];
    }
}
