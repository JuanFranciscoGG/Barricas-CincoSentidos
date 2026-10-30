import { ActivationForm } from "./ActivationForm";

// The single-use token travels in the URL fragment (#...), which browsers never
// send to the server — so it cannot end up in access logs or Referer headers.
export default function ActivarPage() {
  return <ActivationForm />;
}
