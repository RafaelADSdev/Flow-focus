"use client";

import { useEffect, useState } from "react";
import { greetingForName } from "@/lib/greeting";

export function PageGreeting({ nome }: { nome: string }) {
  const [greeting, setGreeting] = useState(() => greetingForName(nome));

  useEffect(() => {
    setGreeting(greetingForName(nome));
    const interval = window.setInterval(() => setGreeting(greetingForName(nome)), 60_000);
    return () => window.clearInterval(interval);
  }, [nome]);

  return <p className="page-greeting">{greeting}</p>;
}
