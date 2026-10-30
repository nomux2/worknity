<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class DeviceAuthRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true; // Anyone can attempt device auth
    }

    public function rules(): array
    {
        return [
            'device_code' => 'required|string',
            'access_token' => 'required|string',
        ];
    }
}
