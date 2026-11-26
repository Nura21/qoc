import { IonContent, IonHeader, IonPage, IonToolbar } from '@ionic/react';
import { documentTextOutline } from 'ionicons/icons';
import React from 'react';
import { useNavigate } from 'react-router-dom';

import { EmptyState } from '../components/common/EmptyState';
import { useAsyncQuery } from '../hooks/useAsyncQuery';
import { documentService } from '../modules/documents/documentService';
import { appSession } from '../store/appSession';

import DocumentDetailPage from './DocumentDetailPage';

const PreviewTabPage: React.FC = () => {
  const navigate = useNavigate();

  const { data: resolvedId, loading } = useAsyncQuery<string | null>(async () => {
    const lastId = appSession.getLastViewedDocId();
    if (lastId) {
      const existing = await documentService.getDetail(lastId);
      if (existing) return existing.id;
    }
    const docs = await documentService.list();
    return docs[0]?.id ?? null;
  }, null);

  if (resolvedId) {
    return <DocumentDetailPage docIdOverride={resolvedId} />;
  }

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <div className="px-[var(--ds-page-px)] py-2">
            <h1 className="ds-page-title text-[var(--ds-text-primary)]">Preview PDF</h1>
          </div>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <div className="ds-container">
          {!loading && (
            <EmptyState
              icon={documentTextOutline}
              title="Belum ada dokumen untuk dipratinjau"
              description="Buat Quotation atau Invoice terlebih dahulu agar tampilan kertas PDF muncul di sini."
              actionLabel="+ Buat Quotation"
              onAction={() => navigate('/documents/new?type=QUOTATION')}
            />
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default PreviewTabPage;
