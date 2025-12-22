import React from 'react';
import BrandLogo from './BrandLogo';
import MobileMenu from './MobileMenu';

type Variant = 'chat' | 'dashboard' | 'reports' | 'settings' | 'adminpanel';

type HeaderProps = {
    title?: string;
    variant?: Variant;
    extraRight?: React.ReactNode;
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
        <header
            className={headerCls}
            style={{
                background: 'linear-gradient(90deg, #f8fafc 60%, #e3e9f3 100%)',
                boxShadow: '0 4px 24px rgba(26,35,64,0.07)',
                borderBottom: '1.5px solid #e5e7eb',
                padding: '0 0',
                fontFamily: "'Inter', 'Segoe UI', 'Merriweather', serif",
                transition: 'background 0.4s cubic-bezier(.4,0,.2,1), box-shadow 0.4s cubic-bezier(.4,0,.2,1)',
                minHeight: 80,
                display: 'flex',
                alignItems: 'center',
                animation: 'fadeInHeader 0.7s cubic-bezier(.68,-0.55,.27,1.55)'
            }}
        >
            <div
                className="logo"
                aria-label="IA Capital"
                style={{
                    marginLeft: 36,
                    display: 'flex',
                    alignItems: 'center',
                    animation: 'slideInLeft 0.7s cubic-bezier(.68,-0.55,.27,1.55)'
                }}
            >
                <BrandLogo width={110} height={32} />
            </div>

            <h1
                className={titleCls}
                style={{
                    flex: 1,
                    margin: 0,
                    fontSize: 28,
                    fontWeight: 700,
                    color: '#1a2340',
                    letterSpacing: 1,
                    textAlign: 'center',
                    fontFamily: "'Inter', 'Segoe UI', 'Merriweather', serif",
                    textShadow: '0 2px 8px rgba(191,161,74,0.06)',
                    animation: 'fadeInTitle 0.9s cubic-bezier(.68,-0.55,.27,1.55)'
                }}
            >
                {title}
            </h1>

            <div
                className="header-right"
                style={{
                    display: 'flex',
                    gap: 16,
                    alignItems: 'center',
                    marginRight: 36,
                    animation: 'slideInRight 0.7s cubic-bezier(.68,-0.55,.27,1.55)'
                }}
            >
                {extraRight}
                {showMenu && <MobileMenu />}
            </div>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
                @keyframes fadeInHeader {
                    0% { opacity: 0; transform: translateY(-24px);}
                    100% { opacity: 1; transform: translateY(0);}
                }
                @keyframes fadeInTitle {
                    0% { opacity: 0; transform: translateY(24px);}
                    100% { opacity: 1; transform: translateY(0);}
                }
                @keyframes slideInLeft {
                    0% { opacity: 0; transform: translateX(-40px);}
                    100% { opacity: 1; transform: translateX(0);}
                }
                @keyframes slideInRight {
                    0% { opacity: 0; transform: translateX(40px);}
                    100% { opacity: 1; transform: translateX(0);}
                }
            `}</style>
        </header>
    );
}