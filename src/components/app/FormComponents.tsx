"use client";

import React from "react";

// Form Field Component
interface FormFieldProps {
  label: string;
  name?: string;
  type?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
  className?: string;
  inputClassName?: string;
}

export function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error,
  hint,
  icon,
  className = "",
  inputClassName = "",
}: FormFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {icon}
          </div>
        )}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          className={`
            w-full px-4 py-3 rounded-xl border
            ${error 
              ? "border-red-300 dark:border-red-700 focus:ring-red-500 focus:border-red-500" 
              : "border-gray-200 dark:border-gray-600 focus:ring-gray-900 dark:focus:ring-gray-100 focus:border-transparent"
            }
            ${disabled ? "bg-gray-50 dark:bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-white dark:bg-gray-800"}
            ${icon ? "pl-10" : ""}
            text-gray-900 dark:text-white
            placeholder:text-gray-400 dark:placeholder:text-gray-500
            focus:ring-2 focus:outline-none
            transition
            ${inputClassName}
          `}
        />
      </div>
      {error && (
        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{hint}</p>
      )}
    </div>
  );
}

// Form Select Component
interface FormSelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface FormSelectProps {
  label: string;
  name?: string;
  value?: string | number;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: FormSelectOption[];
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
  className?: string;
}

export function FormSelect({
  label,
  name,
  value,
  onChange,
  options,
  placeholder,
  required = false,
  disabled = false,
  error,
  hint,
  className = "",
}: FormSelectProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <select
        name={name}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`
          w-full px-4 py-3 rounded-xl border appearance-none cursor-pointer
          ${error 
            ? "border-red-300 dark:border-red-700 focus:ring-red-500 focus:border-red-500" 
            : "border-gray-200 dark:border-gray-600 focus:ring-gray-900 dark:focus:ring-gray-100 focus:border-transparent"
          }
          ${disabled ? "bg-gray-50 dark:bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-white dark:bg-gray-800"}
          text-gray-900 dark:text-white
          focus:ring-2 focus:outline-none
          transition
          bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2024%2024%22%20stroke%3D%22%236b7280%22%3E%3Cpath%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%222%22%20d%3D%22M19%209l-7%207-7-7%22%2F%3E%3C%2Fsvg%3E')]
          bg-[length:1.25rem] bg-[right_0.75rem_center] bg-no-repeat
          pr-10
        `}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option 
            key={option.value} 
            value={option.value} 
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{hint}</p>
      )}
    </div>
  );
}

// Form TextArea Component
interface FormTextAreaProps {
  label: string;
  name?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  hint?: string;
  rows?: number;
  maxLength?: number;
  className?: string;
}

export function FormTextArea({
  label,
  name,
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error,
  hint,
  rows = 4,
  maxLength,
  className = "",
}: FormTextAreaProps) {
  return (
    <div className={className}>
      <div className="flex justify-between items-center mb-2">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
        {maxLength && value && (
          <span className="text-xs text-gray-400">
            {value.length}/{maxLength}
          </span>
        )}
      </div>
      <textarea
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        rows={rows}
        maxLength={maxLength}
        className={`
          w-full px-4 py-3 rounded-xl border resize-none
          ${error 
            ? "border-red-300 dark:border-red-700 focus:ring-red-500 focus:border-red-500" 
            : "border-gray-200 dark:border-gray-600 focus:ring-gray-900 dark:focus:ring-gray-100 focus:border-transparent"
          }
          ${disabled ? "bg-gray-50 dark:bg-gray-700 text-gray-500 cursor-not-allowed" : "bg-white dark:bg-gray-800"}
          text-gray-900 dark:text-white
          placeholder:text-gray-400 dark:placeholder:text-gray-500
          focus:ring-2 focus:outline-none
          transition
        `}
      />
      {error && (
        <p className="mt-1.5 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {hint && !error && (
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">{hint}</p>
      )}
    </div>
  );
}
