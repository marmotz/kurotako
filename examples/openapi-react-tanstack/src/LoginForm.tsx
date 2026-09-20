import type { LoginDtoFormValues } from 'api/react-tanstack/LoginDto.form';
import { useLoginDtoForm } from 'api/react-tanstack/LoginDto.form';
import { LoginDtoSchema } from 'api/react-tanstack/zod/LoginDto.schema';
import { errorMessage } from './errors';

/**
 * A rule the OpenAPI contract cannot express, added where the form is built: the
 * generated schema is refined at runtime and handed to the hook as `schema`.
 */
export const strictLoginSchema = LoginDtoSchema.refine(
  (value) => !value.password.toLowerCase().includes('password'),
  { message: 'The password must not contain the word "password"', path: ['password'] },
);

export function LoginForm(props: {
  onLogin: (dto: LoginDtoFormValues) => void | Promise<void>;
}) {
  const form = useLoginDtoForm({
    schema: strictLoginSchema,
    onSubmit: async ({ value, formApi }) => {
      try {
        await props.onLogin(value);
      } catch {
        // A server-side failure is put on the field the same way a Zod issue is.
        formApi.setErrorMap({
          onSubmit: { fields: { email: 'Unknown email or password' } },
        });
      }
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="email">
        {(field) => (
          <label>
            Email
            <input
              type="email"
              value={field.state.value}
              onBlur={field.handleBlur}
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
      <form.Field name="password">
        {(field) => (
          <label>
            Password
            <input
              type="password"
              value={field.state.value}
              onBlur={field.handleBlur}
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
      <button type="submit">Log in</button>
    </form>
  );
}
