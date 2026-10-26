import type { ReactElement, ReactNode } from 'react';

import { describedBy, FieldNotes, type FieldMessages } from './fields';

export interface Choice {
  readonly value: string;
  readonly label: ReactNode;
  readonly checked?: boolean;
}

export interface ChoiceGroupProps extends FieldMessages {
  /** Prefix for every id in the group; also the fieldset's id for its hint and error. */
  readonly id: string;
  readonly name: string;
  readonly legend: ReactNode;
  /** Radio for one answer (a priority), checkbox for several (functions, levers). */
  readonly type: 'radio' | 'checkbox';
  readonly choices: readonly Choice[];
  readonly required?: boolean;
  /** Lay the choices in a row, for short ones such as More, Standard, Save. */
  readonly inline?: boolean;
}

/** A fieldset with a legend; each choice is a full-height label so the target is 44 px. */
export function ChoiceGroup({
  id,
  name,
  legend,
  type,
  choices,
  required,
  inline = false,
  hint,
  error,
}: ChoiceGroupProps): ReactElement {
  return (
    <fieldset
      id={id}
      aria-describedby={describedBy(id, { hint, error })}
      className="my-4 rounded border border-line px-3 pb-2"
    >
      <legend className="px-1 font-medium">{legend}</legend>
      <div className={inline ? 'flex flex-wrap gap-x-4' : ''}>
        {choices.map((choice) => {
          const choiceId = `${id}-${choice.value}`;
          return (
            <label
              key={choice.value}
              htmlFor={choiceId}
              className="flex min-h-11 items-center gap-2"
            >
              <input
                id={choiceId}
                type={type}
                name={name}
                value={choice.value}
                defaultChecked={choice.checked}
                required={type === 'radio' ? required : undefined}
                className="h-5 w-5 shrink-0"
              />
              <span>{choice.label}</span>
            </label>
          );
        })}
      </div>
      <FieldNotes id={id} hint={hint} error={error} />
    </fieldset>
  );
}
