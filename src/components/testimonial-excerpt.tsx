"use client";

import { useState } from "react";

export default function TestimonialExcerpt({ children }: { children: string }) {
  const [expanded, setExpanded] = useState(false);
  const canExpand = children.trim().length > 180;

  return <div className="testimonial-excerpt" data-expanded={expanded}>
    <p>{children}</p>
    {canExpand ? <button type="button" aria-expanded={expanded} onClick={() => setExpanded((current) => !current)}>
      {expanded ? "Ver menos" : "Ver mais"}
    </button> : null}
  </div>;
}
