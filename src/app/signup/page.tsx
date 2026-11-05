import { Suspense } from "react";
import { SignupForm } from "./signup-form";

export const metadata = { title: "สมัครใช้งาน · Asbuilt" };

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
