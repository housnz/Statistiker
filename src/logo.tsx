// Logo: Volleyball in Blau-Gelb mit eckiger schwarzer Brille.
export const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><clipPath id="b"><circle cx="50" cy="50" r="44"/></clipPath>
<path id="s" d="M50 50C62 40 32 22 50 6A44 44 0 0 1 88.1 72C83.25 48.41 52.66 65.39 50 50Z"/>
<path id="m" d="M50 50C62 40 32 22 50 6"/></defs>
<circle cx="50" cy="50" r="44" fill="#f5c518"/>
<g clip-path="url(#b)" transform="rotate(-25 50 50)">
<use href="#s" fill="#1f5fbf"/>
<use href="#s" fill="#f5c518" transform="rotate(120 50 50)"/>
<use href="#s" fill="#3d86e8" transform="rotate(240 50 50)"/>
<g fill="none" stroke="#0d2a5c" stroke-width="2.4" stroke-linecap="round">
<use href="#m"/><use href="#m" transform="rotate(120 50 50)"/><use href="#m" transform="rotate(240 50 50)"/>
</g>
<g fill="none" stroke="#0d2a5c" stroke-width="1.6" stroke-linecap="round" opacity=".45">
<path d="M50 50C62 40 32 22 50 6" transform="rotate(42 50 50)" pathLength="100" stroke-dasharray="0 45 55"/>
<path d="M50 50C62 40 32 22 50 6" transform="rotate(162 50 50)" pathLength="100" stroke-dasharray="0 45 55"/>
<path d="M50 50C62 40 32 22 50 6" transform="rotate(282 50 50)" pathLength="100" stroke-dasharray="0 45 55"/>
</g></g>
<circle cx="50" cy="50" r="44" fill="none" stroke="#0d2a5c" stroke-width="3"/>
<g stroke="#111" stroke-width="5" stroke-linejoin="round">
<rect x="15" y="40" width="30" height="21" rx="3.5" fill="#ffffff" fill-opacity=".5"/>
<rect x="55" y="40" width="30" height="21" rx="3.5" fill="#ffffff" fill-opacity=".5"/>
<path d="M45 47Q50 42.5 55 47" fill="none" stroke-width="4"/>
<path d="M15 45L5 42M85 45L95 42" fill="none" stroke-width="4" stroke-linecap="round"/>
</g>
<path d="M20 45L26 45M60 45L66 45" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>
</svg>`;

export const LOGO_DATA_URL = `data:image/svg+xml;utf8,${encodeURIComponent(LOGO_SVG)}`;

export function Logo({ size = 40 }: { size?: number }) {
  return <img src={LOGO_DATA_URL} width={size} height={size} alt="Statistiker" style={{ display: 'block' }} />;
}
