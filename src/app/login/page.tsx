import { Suspense } from "react";
import LoginPage from "./LoginForm";

export default function LoginPageWrapper() {
  return (
    <Suspense fallback={<main className="mx-auto min-h-screen max-w-md px-4 py-12" />}>
      <LoginPage />
    </Suspense>
  );
}
