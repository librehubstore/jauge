import { SignupForm } from "@/components/AuthForms";

export default function SignupPage() {
  return <SignupForm google={!!process.env.GOOGLE_CLIENT_ID} />;
}
