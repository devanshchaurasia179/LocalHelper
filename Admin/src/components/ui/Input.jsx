import { forwardRef } from 'react'
import { cn } from '@/utils/cn'

/**
 * Input — styled text input with optional left/right icon slots and error state.
 * Uses forwardRef so React Hook Form's register() can attach its ref.
 */
const Input = forwardRef(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      className,
      containerClassName,
      required,
      ...props
    },
    ref
  ) => {
    return (
      <div className={cn('flex flex-col gap-1.5', containerClassName)}>
        {label && (
          <label
            className="text-sm font-medium text-slate-700"
            htmlFor={props.id || props.name}
          >
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={props.id || props.name}
            className={cn(
              'block w-full rounded-xl border bg-white text-slate-800 text-sm',
              'placeholder:text-slate-400',
              'transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent',
              'disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed',
              // height + padding
              'h-10 px-3.5',
              leftIcon  && 'pl-9',
              rightIcon && 'pr-9',
              // border colour changes based on error state
              error
                ? 'border-red-300 focus:ring-red-400'
                : 'border-slate-200 hover:border-slate-300',
              className
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${props.name}-error` : undefined}
            {...props}
          />

          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>

        {error && (
          <p
            id={`${props.name}-error`}
            className="text-xs text-red-600 flex items-center gap-1"
            role="alert"
          >
            {error}
          </p>
        )}
        {!error && helperText && (
          <p className="text-xs text-slate-500">{helperText}</p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
