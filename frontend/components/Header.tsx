// frontend/components/Header.tsx
import React from 'react';
import BrandLogo from './BrandLogo';
import MobileMenu from './MobileMenu';

type Variant = 'chat' | 'dashboard' | 'reports' | 'settings' | 'adminpanel';

type HeaderProps = {
    title?: string;
    variant?: Variant;             // aplica clases por página
    extraRight?: React.ReactNode;  // botones extra
    showMenu?: boolean;
};

export default function Header({
    title = 'Dashboard',
    variant = 'dashboard',
    extraRight,
    showMenu = true,
}: HeaderProps) {
    const headerCls =
        variant === 'chat' ? 'chat-header'
            : variant === 'reports' ? 'reports-header'
                : variant === 'settings' ? 'settings-header'
                    : variant === 'adminpanel' ? 'adminpanel-header'
                        : 'dashboard-header';

    const titleCls =
        variant === 'chat' ? 'chat-title page-title'
            : variant === 'reports' ? 'reports-title page-title'
                : variant === 'adminpanel' ? 'adminpanel-title page-title'
                    : 'page-title';

    return (
        <header className={headerCls}>
            <div className="logo" aria-label="IA Capital">
                <BrandLogo width={96} height={28} />
            </div>

            <h1 className={titleCls}>{title}</h1>

            <div className="header-right" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {extraRight}
                {showMenu && <MobileMenu />}
            </div>
        </header>
    );
}
