import { redirect } from "next/navigation";

/** Legacy /visit entry — send parents to the Patient Hub. */
export default function VisitPage() {
  redirect("/");
}
