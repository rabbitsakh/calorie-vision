"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { shouldTrackMetrikaPath } from "@/lib/yandex-metrika";

declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...args: unknown[]) => void;
  }
}

type YandexMetrikaProps = {
  counterId: string;
};

export function YandexMetrika({ counterId }: YandexMetrikaProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const id = Number(counterId);

  useEffect(() => {
    if (!Number.isFinite(id) || !pathname || !shouldTrackMetrikaPath(pathname)) {
      return;
    }
    const query = searchParams.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    window.ym?.(id, "hit", url);
  }, [id, pathname, searchParams]);

  return (
    <>
      <Script id="yandex-metrika" strategy="afterInteractive">{`
(function(m,e,t,r,i,k,a){
  m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for (var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
ym(${id}, "init", {
  defer: true,
  clickmap: true,
  trackLinks: true,
  accurateTrackBounce: true,
  webvisor: true
});
      `}</Script>
      <noscript>
        <div>
          <img
            src={`https://mc.yandex.ru/watch/${id}`}
            style={{ position: "absolute", left: "-9999px" }}
            alt=""
          />
        </div>
      </noscript>
    </>
  );
}
