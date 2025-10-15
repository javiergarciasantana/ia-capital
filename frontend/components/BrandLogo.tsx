// frontend/components/BrandLogo.tsx
import Image from 'next/image';
import { useTheme } from 'next-themes';

type Props = { width?: number; height?: number; className?: string; alt?: string };

export default function BrandLogo({ width = 96, height = 28, className = '', alt = 'IA Capital' }: Props) {
    const { theme, systemTheme } = useTheme();
    const active = theme === 'system' ? systemTheme : theme;

    // Si no tienes /logo-dark.svg, deja siempre '/logo.svg'
    const src = active === 'dark' ? '/logo-dark.png' : '/logo.png';

    return (
        <Image src={src} alt={alt} width={width} height={height} priority className={className} />
    );
}
