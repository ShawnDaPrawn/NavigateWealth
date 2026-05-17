import React from 'react';
import { Label } from '../ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../ui/input-otp';

interface VerificationCodeFieldProps {
  id: string;
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function VerificationCodeField({
  id,
  label,
  description,
  value,
  onChange,
  disabled = false,
}: VerificationCodeFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </Label>
      <InputOTP
        id={id}
        maxLength={6}
        value={value}
        onChange={onChange}
        disabled={disabled}
        pattern="^[0-9]*$"
        containerClassName="justify-start"
      >
        <InputOTPGroup>
          {Array.from({ length: 6 }, (_, index) => (
            <InputOTPSlot key={index} index={index} className="h-11 w-11 rounded-md border text-base" />
          ))}
        </InputOTPGroup>
      </InputOTP>
      <p className="text-xs text-gray-500">{description}</p>
    </div>
  );
}
