import type { Metadata } from "next";
import InvitePasswordForm from "./invite-password-form";

export const metadata: Metadata = {
  title: "Criar senha da Família",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AcceptMemberInvitePage() {
  return <InvitePasswordForm />;
}
