"use client";

import { useRouter } from "next/navigation";

type BackButtonProps = {
  label?: string;
};

export function BackButton({ label = "Назад" }: BackButtonProps) {
  const router = useRouter();

  return (
    <button type="button" className="btn btn-secondary text-sm" onClick={() => router.back()}>
      {label}
    </button>
  );
}
