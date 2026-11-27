import { App as CapApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { IonIcon, IonRouterOutlet, IonToast, useIonRouter } from '@ionic/react';
import { cubeOutline, documentAttachOutline, documentTextOutline, homeOutline, personOutline } from 'ionicons/icons';
import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, Route, useLocation, useNavigate } from 'react-router-dom';

import { AppTourOverlay } from '../components/common/AppTourOverlay';
import DashboardPage from '../pages/DashboardPage';
import { appTour } from '../store/appTour';
import { hapticLight } from '../utils/haptics';

const loadCatalogPage = () => import('../pages/CatalogPage');
const loadClientsPage = () => import('../pages/ClientsPage');
const loadDocumentDetailPage = () => import('../pages/DocumentDetailPage');
const loadDocumentForm = () => import('../pages/DocumentForm');
const loadDocumentsPage = () => import('../pages/DocumentsPage');
const loadPreviewTabPage = () => import('../pages/PreviewTabPage');
const loadProfilePage = () => import('../pages/ProfilePage');

const CatalogPage = lazy(loadCatalogPage);
const ClientsPage = lazy(loadClientsPage);
const DocumentDetailPage = lazy(loadDocumentDetailPage);
const DocumentForm = lazy(loadDocumentForm);
const DocumentsPage = lazy(loadDocumentsPage);
const PreviewTabPage = lazy(loadPreviewTabPage);
const ProfilePage = lazy(loadProfilePage);

const PageSuspenseFallback: React.FC = () => (
  <div className="flex h-full items-center justify-center bg-[var(--app-surface)] text-xs text-[var(--ds-text-muted)]">
    Memuat...
  </div>
);

function withSuspense(node: React.ReactNode): React.ReactNode {
  return <Suspense fallback={<PageSuspenseFallback />}>{node}</Suspense>;
}

interface TabItem {
  id: 'dashboard' | 'documents' | 'catalog' | 'preview' | 'profile';
  label: string;
  path: string;
  icon: string;
  tourId?: string;
}

const TAB_ITEMS: TabItem[] = [
  { id: 'dashboard', label: 'Beranda', path: '/dashboard', icon: homeOutline },
  { id: 'documents', label: 'Dokumen', path: '/documents', icon: documentTextOutline, tourId: 'tour-tab-documents' },
  { id: 'catalog', label: 'Barang', path: '/catalog', icon: cubeOutline, tourId: 'tour-tab-catalog' },
  { id: 'preview', label: 'Preview', path: '/preview', icon: documentAttachOutline },
  { id: 'profile', label: 'Profil', path: '/profile', icon: personOutline, tourId: 'tour-tab-profile' },
];

const ROOT_TAB_PATHS = new Set<string>(TAB_ITEMS.map((t) => t.path));

function resolveActiveTab(pathname: string): TabItem['id'] {
  if (pathname === '/documents' || pathname.startsWith('/documents/')) return 'documents';
  if (pathname === '/catalog' || pathname.startsWith('/catalog/')) return 'catalog';
  if (pathname === '/preview' || pathname.startsWith('/preview/')) return 'preview';
  if (pathname === '/profile' || pathname.startsWith('/profile/') || pathname === '/clients') return 'profile';
  return 'dashboard';
}

export const AppRoutes: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const ionRouter = useIonRouter();
  const pathnameRef = useRef(location.pathname);
  const navigateRef = useRef(navigate);
  const ionRouterRef = useRef(ionRouter);
  const lastBackPressRef = useRef(0);
  const [exitToastOpen, setExitToastOpen] = useState(false);

  useEffect(() => {
    pathnameRef.current = location.pathname;
    navigateRef.current = navigate;
    ionRouterRef.current = ionRouter;
  }, [location.pathname, navigate, ionRouter]);

  /**
   * Navigates deterministically to a tab's root route, clearing any pushed sub-routes
   * (such as `/documents/:id`) so switching tabs ALWAYS works and returning to Dokumen
   * always starts fresh from `/documents`.
   */
  const navigateToTabRoot = useCallback(
    (targetPath: string) => {
      if (location.pathname === targetPath && !location.search) {
        const activeContent = document.querySelector<HTMLElement & { scrollToTop?: (ms?: number) => Promise<void> }>(
          '.ion-page:not(.ion-page-hidden) ion-content',
        );
        void activeContent?.scrollToTop?.(240);
        return;
      }

      void hapticLight();
      if (typeof ionRouter.navigateRoot === 'function') {
        ionRouter.navigateRoot(targetPath);
      } else {
        navigate(targetPath, { replace: true });
      }
    },
    [ionRouter, location.pathname, location.search, navigate],
  );

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let active = true;
    const listenerPromise = CapApp.addListener('backButton', ({ canGoBack }) => {
      if (!active) return;

      // Dismiss active App Tour before handling overlays or page navigation
      if (appTour.isActive()) {
        appTour.complete();
        return;
      }

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
        if (typeof ionRouterRef.current.navigateRoot === 'function') {
          ionRouterRef.current.navigateRoot('/dashboard');
        } else {
          navigateRef.current('/dashboard', { replace: true });
        }
      } else if (canGoBack) {
        navigateRef.current(-1);
      } else if (currentPath.startsWith('/documents/')) {
        if (typeof ionRouterRef.current.navigateRoot === 'function') {
          ionRouterRef.current.navigateRoot('/documents');
        } else {
          navigateRef.current('/documents', { replace: true });
        }
      } else if (typeof ionRouterRef.current.navigateRoot === 'function') {
        ionRouterRef.current.navigateRoot('/dashboard');
      } else {
        navigateRef.current('/dashboard', { replace: true });
      }
    });

    return () => {
      active = false;
      void listenerPromise.then((handle) => handle.remove());
    };
  }, []);

  // Warm-preload lazy page chunks silently after splash finishes so tab & page switches never stall
  useEffect(() => {
    if (import.meta.env.MODE === 'test') return;
    const timer = window.setTimeout(() => {
      void Promise.allSettled([
        loadDocumentsPage(),
        loadCatalogPage(),
        loadPreviewTabPage(),
        loadProfilePage(),
        loadDocumentForm(),
        loadDocumentDetailPage(),
        loadClientsPage(),
      ]);
    }, 1300);
    return () => window.clearTimeout(timer);
  }, []);

  const activeTab = resolveActiveTab(location.pathname);

  const showTabBar =
    ROOT_TAB_PATHS.has(location.pathname) ||
    (location.pathname.startsWith('/documents/') &&
      !location.pathname.endsWith('/new') &&
      !location.pathname.endsWith('/edit'));

  return (
    <>
      <div className="qoc-app-shell">
        <div className="qoc-app-outlet">
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
        </div>

        {/* 5 Blueprint Tabs: Beranda | Dokumen | Barang | Preview | Profil */}
        <nav
          aria-label="Navigasi utama"
          aria-hidden={!showTabBar}
          className={`qoc-bottom-nav ${showTabBar ? '' : 'qoc-tabbar-hidden'}`}
        >
          {TAB_ITEMS.map((tab) => {
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={isSelected ? 'page' : undefined}
                data-tab={tab.id}
                data-selected={String(isSelected)}
                data-tour-id={tab.tourId}
                onClick={() => navigateToTabRoot(tab.path)}
                className="qoc-nav-btn"
              >
                <IonIcon aria-hidden="true" icon={tab.icon} className="qoc-nav-icon" />
                <span className="qoc-nav-label">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <AppTourOverlay />

      <IonToast
        isOpen={exitToastOpen}
        message="Tekan sekali lagi untuk keluar dari QOC"
        duration={1800}
        onDidDismiss={() => setExitToastOpen(false)}
      />
    </>
  );
};
