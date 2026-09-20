import type { RegisterDtoFormValues } from 'api/react-tanstack/RegisterDto.form';
import { useRegisterDtoForm } from 'api/react-tanstack/RegisterDto.form';
import { errorMessage } from './errors';

/** The generated defaults (`''`, `false`, ...) are overridden per field through `defaultValues`. */
export function RegisterForm(props: {
  onRegister: (dto: RegisterDtoFormValues) => void | Promise<void>;
}) {
  const form = useRegisterDtoForm({
    defaultValues: { newsletter: true },
    onSubmit: ({ value }) => props.onRegister(value),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="displayName">
        {(field) => (
          <label>
            Display name
            <input
              value={field.state.value}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            {field.state.meta.errors.map((error) => (
              <span key={errorMessage(error)} role="alert">
                {errorMessage(error)}
              </span>
            ))}
          </label>
        )}
      </form.Field>
      <form.Field name="newsletter">
        {(field) => (
          <label>
            <input
              type="checkbox"
              checked={field.state.value}
              onChange={(event) => field.handleChange(event.target.checked)}
            />
            Newsletter
          </label>
        )}
      </form.Field>
      <button type="submit">Register</button>
    </form>
  );
}
