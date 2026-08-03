import type { Metadata } from "next";
import { getSaoPauloDateKey } from "@/lib/calendar-events";
import CalendarExperience from "./calendar-experience";

export const metadata: Metadata = {
  title: "Calendário da Casa",
  description: "Confira os cultos, encontros e programações especiais da Igreja Casa Forte Erechim.",
};

export default function CalendarPage() {
  return <CalendarExperience today={getSaoPauloDateKey()} />;
}
