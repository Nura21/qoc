import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs, IonToast } from '@ionic/react';
import { cubeOutline, documentAttachOutline, documentTextOutline, homeOutline, personOutline } from 'ionicons/icons';
import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Navigate, Route, useLocation, useNavigate } from 'react-router-dom';

import DashboardPage from '../pages/DashboardPage';

const CatalogPage = lazy(() => import('../pages/CatalogPage'));
const ClientsPage = lazy(() => import('../pages/ClientsPage'));
const DocumentDetailPage = lazy(() => import('../pages/DocumentDetailPage'));
const DocumentForm = lazy(() => import('../pages/DocumentForm'));
const DocumentsPage = lazy(() => import('../pages/DocumentsPage'));
const PreviewTabPage = lazy(() => import('../pages/PreviewTabPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));

const PageSuspenseFallback: React.FC = () => (
  <div className="flex h-full items-center justify-center bg-[var(--app-surface)] text-xs text-[var(--ds-text-muted)]">
    Memuat...
  </div>
);

function withSuspense(node: React.ReactNode): React.ReactNode {
  return <Suspense fallback={<PageSuspenseFallback />}>{node}</Suspense>;
}

const ROOT_TAB_PATHS = new Set(['/dashboard', '/documents', '/catalog', '/preview', '/profile']);

export const AppRoutes: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const pathnameRef = useRef(location.pathname);
  const navigateRef = useRef(navigate);
  const lastBackPressRef = useRef(0);
  const [exitToastOpen, setExitToastOpen] = useState(false);

  useEffect(() => {
    pathnameRef.current = location.pathname;
    navigateRef.current = navigate;
  }, [location.pathname, navigate]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    const listenerPromise = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (!active) return;

      // Only dismiss an overlay that is ACTUALLY visible (ignore hidden/unopened ion-alert/ion-action-sheet)
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement & { dismiss?: () => Promise<boolean> }>(
          'ion-alert, ion-action-sheet, ion-modal.show-modal',
        ),
      );
      const visibleOverlay = candidates.find((el) => {
        if (el.classList.contains('overlay-hidden')) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
      });
      if (visibleOverlay?.dismiss) {
        void visibleOverlay.dismiss();
        return;
      }

      const currentPath = pathnameRef.current;

      if (currentPath === '/dashboard' || currentPath === '/') {
        const now = Date.now();
        if (now - lastBackPressRef.current < 2500) {
          void CapApp.exitApp();
        } else {
          lastBackPressRef.current = now;
          setExitToastOpen(true);
        }
        return;
      }

      if (ROOT_TAB_PATHS.has(currentPath)) {
        navigateRef.current('/dashboard', { replace: true });
      } else if (canGoBack) {
        navigateRef.current(-1);
      } else {
        navigateRef.current('/dashboard', { replace: true });
      }
    });

    return () => {
      active = false;
      void listenerPromise.then((handle) => handle.remove());
    };
  }, []);

  const showTabBar =
    ROOT_TAB_PATHS.has(location.pathname) ||
    (location.pathname.startsWith('/documents/') &&
      !location.pathname.endsWith('/new') &&
      !location.pathname.endsWith('/edit'));

  return (
    <>
      <IonTabs>
        <IonRouterOutlet>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/documents" element={withSuspense(<DocumentsPage />)} />
          <Route path="/documents/new" element={withSuspense(<DocumentForm />)} />
          <Route path="/documents/:id/edit" element={withSuspense(<DocumentForm />)} />
          <Route path="/documents/:id" element={withSuspense(<DocumentDetailPage />)} />
          <Route path="/catalog" element={withSuspense(<CatalogPage />)} />
          <Route path="/preview" element={withSuspense(<PreviewTabPage />)} />
          <Route path="/clients" element={withSuspense(<ClientsPage />)} />
          <Route path="/profile" element={withSuspense(<ProfilePage />)} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </IonRouterOutlet>

        {/* 5 Blueprint Tabs: Beranda | Dokumen | Barang | Preview | Profil */}
        <IonTabBar slot="bottom" style={showTabBar ? undefined : { display: 'none' }}>
          <IonTabButton tab="dashboard" href="/dashboard">
            <IonIcon aria-hidden="true" icon={homeOutline} />
            <IonLabel>Beranda</IonLabel>
          </IonTabButton>
          <IonTabButton tab="documents" href="/documents">
            <IonIcon aria-hidden="true" icon={documentTextOutline} />
            <IonLabel>Dokumen</IonLabel>
          </IonTabButton>
          <IonTabButton tab="catalog" href="/catalog">
            <IonIcon aria-hidden="true" icon={cubeOutline} />
            <IonLabel>Barang</IonLabel>
          </IonTabButton>
          <IonTabButton tab="preview" href="/preview">
            <IonIcon aria-hidden="true" icon={documentAttachOutline} />
            <IonLabel>Preview</IonLabel>
          </IonTabButton>
          <IonTabButton tab="profile" href="/profile">
            <IonIcon aria-hidden="true" icon={personOutline} />
            <IonLabel>Profil</IonLabel>
          </IonTabButton>
        </IonTabBar>
      </IonTabs>

      <IonToast
        isOpen={exitToastOpen}
        message="Tekan sekali lagi untuk keluar dari QOC"
        duration={1800}
        onDidDismiss={() => setExitToastOpen(false)}
      />
    </>
  );
};
