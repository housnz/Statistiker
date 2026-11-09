// Logo: Volleyball mit Nerd-Brille und Statistik-Klemmbrett.
import logoUrl from './assets/logo.webp';

export function Logo({ size = 40 }: { size?: number }) {
  return <img src={logoUrl} width={size} height={size} alt="Statistiker" style={{ display: 'block' }} />;
}
