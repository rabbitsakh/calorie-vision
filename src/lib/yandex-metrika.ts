/** Yandex Metrika counter IDs are numeric (typically 8 digits). */
export function parseMetrikaId(value: string | undefined | null): string | null {
  const trimmed = value?.trim() ?? "";
  if (!/^\d{6,12}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function resolveMetrikaId(
  primary: string | undefined | null,
  fallback?: string | undefined | null,
): string | null {
  return parseMetrikaId(primary) ?? parseMetrikaId(fallback);
}

export function shouldTrackMetrikaPath(pathname: string): boolean {
  return !pathname.startsWith("/admin");
}

/** Official tag.js stub + first hit. `counterId` must already be parseMetrikaId-safe. */
export function buildMetrikaInitScript(counterId: string): string {
  const id = parseMetrikaId(counterId);
  if (!id) {
    return "";
  }
  return `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(${id},"init",{defer:true,clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true});if(location.pathname.indexOf("/admin")!==0){ym(${id},"hit",location.href);}`;
}
