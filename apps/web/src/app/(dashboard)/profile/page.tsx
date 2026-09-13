import type { Metadata } from "next";
import { PageHeader } from "@/common/page-header";
import { ProfileForms } from "@/profile/profile-forms";

export const metadata: Metadata = {
  title: "Profil",
};

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Profil" description="Kelola akun dan akun Threads yang dipantau auto-publish." />
      <ProfileForms />
    </div>
  );
}
