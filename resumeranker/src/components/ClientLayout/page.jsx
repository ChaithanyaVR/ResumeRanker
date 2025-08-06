'use client';

import { usePathname } from 'next/navigation';
import Header from '../Header/header/page';


const hideHeaderPaths = ['/login', '/signup'];

export default function ClientLayout({ children }) {
  const pathname = usePathname();
  const shouldShowHeader = !hideHeaderPaths.includes(pathname);

  return (
    <>
      {shouldShowHeader && <Header />}
      {children}
    </>
  );
}
