import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireHr } from "@/lib/auth";
import { can } from "@/lib/hr/permissions";
import { HrPanel, PageTitle } from "@/components/hr/panel";
import { PositionForm } from "../position-form";

export const metadata: Metadata = { title: "New position" };

export default async function NewPositionPage() {
  const { profile } = await requireHr();
  if (!can(profile.role).managePositions) redirect("/hr/positions");
  return (
    <div className="max-w-3xl">
      <PageTitle title="New position" />
      <HrPanel><div className="p-5 sm:p-6">
        <PositionForm defaults={{ title: "", department: "", location: "", employmentType: "full_time", description: "", applicationDeadline: "", status: "open", isActive: true }} />
      </div></HrPanel>
    </div>
  );
}
