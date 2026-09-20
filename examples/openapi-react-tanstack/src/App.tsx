import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

export function App() {
  return (
    <main>
      <h1>kurotako + TanStack Form</h1>
      <h2>Log in</h2>
      <LoginForm onLogin={(dto) => console.log('login', dto)} />
      <h2>Register</h2>
      <RegisterForm onRegister={(dto) => console.log('register', dto)} />
    </main>
  );
}
