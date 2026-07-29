"use client";

import { useEffect, useState } from "react";
import { greetingForName } from "@/lib/greeting";

export function PageGreeting({ nome }: { nome: string }) {
  const firstName = nome.trim().split(/\s+/)[0] ?? nome;
  const [greeting, setGreeting] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(greetingForName(nome));
    const interval = window.setInterval(() => setGreeting(greetingForName(nome)), 60_000);
    return () => window.clearInterval(interval);
  }, [nome]);

  return <p className="page-greeting">{greeting ?? `Olá, ${firstName}`}</p>;
}
