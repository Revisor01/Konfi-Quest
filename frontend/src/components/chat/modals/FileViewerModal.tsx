import React from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon
} from '@ionic/react';
import { closeOutline, documentOutline, downloadOutline } from 'ionicons/icons';

interface FileViewerModalProps {
  blobUrl: string;
  fileName: string;
  mimeType: string;
  onClose: () => void;
}

const FileViewerModal: React.FC<FileViewerModalProps> = ({
  blobUrl,
  fileName,
  mimeType,
  onClose
}) => {
  const isImage = mimeType.startsWith('image/');
  const isPdf = mimeType === 'application/pdf';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton className="app-modal-close-btn" onClick={onClose}>
              <IonIcon icon={closeOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
          <IonTitle>{fileName}</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className={isImage || isPdf ? '' : 'ion-padding'}>
        {isImage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            padding: '8px'
          }}>
            <img
              src={blobUrl}
              alt={fileName}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain'
              }}
            />
          </div>
        )}

        {isPdf && (
          <iframe
            src={blobUrl}
            title={fileName}
            style={{
              width: '100%',
              height: '100%',
              border: 'none'
            }}
          />
        )}

        {!isImage && !isPdf && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '60%',
            gap: '16px',
            color: '#666'
          }}>
            <IonIcon icon={documentOutline} style={{ fontSize: '4rem', opacity: 0.4 }} />
            <p style={{ margin: 0, fontSize: '1rem' }}>Vorschau nicht verfügbar</p>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#999' }}>{fileName}</p>
            <IonButton
              fill="outline"
              onClick={() => window.open(blobUrl, '_blank')}
            >
              <IonIcon icon={downloadOutline} slot="start" />
              Herunterladen
            </IonButton>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default FileViewerModal;
