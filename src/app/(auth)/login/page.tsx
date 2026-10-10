import { Suspense } from "react";
import { LoginForm } from "@/components/AuthForms";

export default function LoginPage() {
  return <Suspense><LoginForm google={!!process.env.GOOGLE_CLIENT_ID} /></Suspense>;
}
