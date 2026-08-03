"use client";

import { useState } from "react";
import { initials } from "@/lib/utils";

export function UserAvatar({
  name,
  photoUrl,
  className,
  loading = "lazy",
}: {
  name: string;
  photoUrl: string | null | undefined;
  className: string;
  loading?: "eager" | "lazy";
}) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const imageUrl = photoUrl && photoUrl !== failedUrl ? photoUrl : null;

  return (
    <span className={className} aria-hidden="true">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          loading={loading}
          decoding="async"
          onError={() => setFailedUrl(imageUrl)}
        />
      ) : initials(name)}
    </span>
  );
}
