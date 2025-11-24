import { App } from '@capacitor/app';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const sub = App.addListener('backButton', () => {
      console.log('BACK BUTTON', location.pathname);

      // Se estiver na Home, pode fechar o app
      if (location.pathname === '/' || location.pathname === '/home') {
        App.exitApp();
      } else {
        navigate(-1);
      }
    });

    return () => {
      sub.remove();
    };
  }, [location.pathname, navigate]);

  return <Outlet />;
}
