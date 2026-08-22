"use client";

import EventAttendanceButton from "@/components/event-attendance-button";
import type { ChurchEvent } from "@/lib/calendar-events";
import { useEventAttendance } from "@/lib/use-event-attendance";

export default function EventAttendanceControl({ event, className = "" }: { event: ChurchEvent; className?: string }) {
  const attendance = useEventAttendance();
  return <EventAttendanceButton event={event} confirmed={attendance.confirmed.has(event.id)} pending={attendance.pendingKey === event.id} onToggle={attendance.toggleAttendance} className={className} />;
}
