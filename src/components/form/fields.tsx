import type { ReactElement, ReactNode } from 'react';

// Every input has a visible label, a hint and an error tied to it with aria-describedby, and
// a 44 px touch target. No placeholder stands in for a label (arch 8).

const INPUT =
  'block min-h-11 w-full rounded border border-line bg-background px-3 py-2 text-base text-foreground';

export interface FieldMessages {
  /** Ids default to `<id>-hint` and `<id>-error`. */
  readonly hint?: ReactNode;
  /** Shown as text next to the field, never as colour alone. */
  readonly error?: ReactNode;
}

export function describedBy(id: string, { hint, error }: FieldMessages): string | undefined {
  const ids = [
    hint === undefined ? null : `${id}-hint`,
    error === undefined ? null : `${id}-error`,
  ];
  const joined = ids.filter((each) => each !== null).join(' ');
  return joined === '' ? undefined : joined;
}

/** The hint and error paragraphs for a field or a fieldset with this id. */
export function FieldNotes({
  id,
  hint,
  error,
}: { readonly id: string } & FieldMessages): ReactElement {
  return (
    <>
      {hint === undefined ? null : (
        <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
          {hint}
        </p>
      )}
      {error === undefined ? null : (
        <p id={`${id}-error`} className="mt-1 text-sm font-medium">
          {error}
        </p>
      )}
    </>
  );
}

export interface TextFieldProps extends FieldMessages {
  readonly name: string;
  readonly label: ReactNode;
  /** Defaults to the name. */
  readonly id?: string;
  readonly type?: 'text' | 'date';
  /** `numeric` for amounts and counts, so a phone opens the number pad. */
  readonly inputMode?: 'numeric' | 'text';
  readonly defaultValue?: string;
  readonly required?: boolean;
  /** Text after the label, such as the dictionary's "(optional)". */
  readonly optionalLabel?: string;
  readonly maxLength?: number;
  readonly autoComplete?: string;
}

export function TextField({
  name,
  label,
  id = name,
  type = 'text',
  inputMode,
  defaultValue,
  required,
  optionalLabel,
  maxLength,
  autoComplete = 'off',
  hint,
  error,
}: TextFieldProps): ReactElement {
  return (
    <div className="my-4">
      <label htmlFor={id} className="block font-medium">
        {label}
        {optionalLabel === undefined ? null : (
          <span className="font-normal text-muted"> {optionalLabel}</span>
        )}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        inputMode={inputMode}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        autoComplete={autoComplete}
        aria-describedby={describedBy(id, { hint, error })}
        aria-invalid={error === undefined ? undefined : true}
        className={INPUT}
      />
      <FieldNotes id={id} hint={hint} error={error} />
    </div>
  );
}

export interface TextAreaProps extends FieldMessages {
  readonly name: string;
  readonly label: ReactNode;
  readonly id?: string;
  readonly defaultValue?: string;
  readonly required?: boolean;
  /** 2,000 by default, the server's free-text cap, so a browser never sends a 422 request. */
  readonly maxLength?: number;
  readonly rows?: number;
}

export function TextArea({
  name,
  label,
  id = name,
  defaultValue,
  required,
  maxLength = 2000,
  rows = 6,
  hint,
  error,
}: TextAreaProps): ReactElement {
  return (
    <div className="my-4">
      <label htmlFor={id} className="block font-medium">
        {label}
      </label>
      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={defaultValue}
        required={required}
        maxLength={maxLength}
        aria-describedby={describedBy(id, { hint, error })}
        aria-invalid={error === undefined ? undefined : true}
        className={INPUT}
      />
      <FieldNotes id={id} hint={hint} error={error} />
    </div>
  );
}
