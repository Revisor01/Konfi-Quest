import React from 'react';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonButtons,
  IonIcon,
  IonTextarea,
  IonFooter,
  IonSpinner
} from '@ionic/react';
import {
  arrowBack,
  send,
  attach,
  barChart,
  people,
  returnUpBack,
  closeCircle,
  ellipsisVertical
} from 'ionicons/icons';
import { Message } from '../../types/chat';
import { formatFileSize } from '../../utils/helpers';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

// Validiert URLs für img src, erlaubt nur sichere Protokolle (blob: und data:)
export const getSafePreviewUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  if (url.startsWith('blob:') || url.startsWith('data:image/')) return url;
  return null;
};

// ChatHeader Komponente
interface ChatHeaderProps {
  roomName: string;
  roomType: string;
  isAdmin: boolean;
  canLeave: boolean;
  isOnline: boolean;
  onBack: () => void;
  onOpenMembers: () => void;
  onOpenPoll: () => void;
  onLeaveChat: () => void;
}

const getHeaderColor = (roomType: string): string => {
  switch (roomType) {
    case 'admin': return '#e11d48';
    case 'jahrgang': return '#06b6d4';
    case 'group': return '#f97316';
    default: return '#5b21b6';
  }
};

export const ChatHeader = React.memo<ChatHeaderProps>(({
  roomName,
  roomType,
  isAdmin,
  canLeave,
  isOnline,
  onBack,
  onOpenMembers,
  onOpenPoll,
  onLeaveChat
}) => {
  const headerColor = getHeaderColor(roomType);
  return (
    <IonHeader translucent={true}>
      <IonToolbar style={{ borderBottom: `3px solid ${headerColor}` }}>
        <IonButtons slot="start">
          <IonButton onClick={onBack}>
            <IonIcon icon={arrowBack} />
          </IonButton>
        </IonButtons>
        <IonTitle>{roomName}</IonTitle>
        <IonButtons slot="end">
          {isAdmin && (
            <>
              <IonButton onClick={onOpenMembers}>
                <IonIcon icon={people} />
              </IonButton>
              <IonButton onClick={onOpenPoll}>
                <IonIcon icon={barChart} />
              </IonButton>
            </>
          )}
          {canLeave && (
            <IonButton disabled={!isOnline} onClick={onLeaveChat}>
              <IonIcon icon={ellipsisVertical} />
            </IonButton>
          )}
        </IonButtons>
      </IonToolbar>
    </IonHeader>
  );
});

// ReplyPreview Komponente
interface ReplyPreviewProps {
  replyToMessage: Message;
  onClear: () => void;
}

export const ReplyPreview = React.memo<ReplyPreviewProps>(({ replyToMessage, onClear }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
    borderTop: '1px solid rgba(6, 182, 212, 0.15)',
    borderLeft: '3px solid #06b6d4',
    gap: '8px'
  }}>
    <IonIcon icon={returnUpBack} style={{ fontSize: '1.2rem', color: '#06b6d4' }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: '600', fontSize: '0.8rem', color: '#06b6d4' }}>
        {replyToMessage.sender_name}
      </div>
      <div style={{
        fontSize: '0.85rem',
        color: '#666',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        {replyToMessage.message_type === 'image' || replyToMessage.message_type === 'video'
          ? (replyToMessage.file_name || 'Medieninhalt')
          : replyToMessage.message_type === 'file'
            ? (replyToMessage.file_name || 'Datei')
            : replyToMessage.message_type === 'poll'
              ? 'Umfrage'
              : (replyToMessage.content || '')}
      </div>
    </div>
    <IonButton
      fill="clear"
      size="small"
      onClick={onClear}
      style={{ '--padding-start': '4px', '--padding-end': '4px' }}
    >
      <IonIcon icon={closeCircle} style={{ fontSize: '1.2rem', color: '#8e8e93' }} />
    </IonButton>
  </div>
));

// FilePreviewBar Komponente
interface FilePreviewBarProps {
  selectedFile: File;
  selectedFilePreview: string | null;
  onClear: () => void;
}

export const FilePreviewBar = React.memo<FilePreviewBarProps>(({ selectedFile, selectedFilePreview, onClear }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    padding: '10px 16px',
    backgroundColor: 'rgba(6, 182, 212, 0.06)',
    borderTop: '1px solid rgba(6, 182, 212, 0.12)',
    borderLeft: '3px solid #06b6d4',
    gap: '10px'
  }}>
    {/* Image Preview or File Icon */}
    {selectedFilePreview ? (
      <div style={{
        width: '48px',
        height: '48px',
        borderRadius: '8px',
        overflow: 'hidden',
        flexShrink: 0,
        border: '2px solid #06b6d4'
      }}>
        <img
          src={getSafePreviewUrl(selectedFilePreview) || ''}
          alt="Preview"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover'
          }}
        />
      </div>
    ) : (
      <div style={{
        width: '44px',
        height: '44px',
        borderRadius: '8px',
        backgroundColor: 'rgba(6, 182, 212, 0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        <IonIcon icon={attach} style={{ fontSize: '1.4rem', color: '#06b6d4' }} />
      </div>
    )}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontWeight: '600',
        fontSize: '0.9rem',
        color: '#1a1a1a',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
      }}>
        {selectedFile.name}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#06b6d4', fontWeight: '500' }}>
        {formatFileSize(selectedFile.size)}
      </div>
    </div>
    <IonButton
      fill="clear"
      size="small"
      onClick={onClear}
      style={{ '--padding-start': '6px', '--padding-end': '6px' }}
    >
      <IonIcon icon={closeCircle} style={{ fontSize: '1.4rem', color: '#8e8e93' }} />
    </IonButton>
  </div>
));

// MessageInput Komponente
interface MessageInputProps {
  messageText: string;
  uploading: boolean;
  selectedFile: File | null;
  selectedFilePreview: string | null;
  replyToMessage: Message | null;
  textareaRef: React.RefObject<HTMLIonTextareaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onTextChange: (value: string) => void;
  onFocus: () => void;
  onSend: () => void;
  onFileSelect: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onClearFile: () => void;
  onClearReply: () => void;
}

export const MessageInput = React.memo<MessageInputProps>(({
  messageText,
  uploading,
  selectedFile,
  selectedFilePreview,
  replyToMessage,
  textareaRef,
  fileInputRef,
  onTextChange,
  onFocus,
  onSend,
  onFileSelect,
  onClearFile,
  onClearReply
}) => (
  <IonFooter style={{ backgroundColor: 'rgba(248, 249, 250, 0.95)', backdropFilter: 'blur(10px)' }}>
    {/* Reply Preview */}
    {replyToMessage && (
      <ReplyPreview replyToMessage={replyToMessage} onClear={onClearReply} />
    )}

    {/* File Preview - direkt an Input angehängt wie Reply */}
    {selectedFile && (
      <FilePreviewBar
        selectedFile={selectedFile}
        selectedFilePreview={selectedFilePreview}
        onClear={onClearFile}
      />
    )}

    <IonToolbar style={{
      '--background': 'transparent',
      '--min-height': 'auto',
      '--padding-start': '12px',
      '--padding-end': '12px',
      '--padding-top': '8px',
      '--padding-bottom': '8px'
    }}>
      {/* Flex-Container für Input und Buttons - vertikal zentriert */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        width: '100%'
      }}>
        <IonButton
          fill="clear"
          size="small"
          onClick={() => fileInputRef.current?.click()}
          style={{
            '--padding-start': '4px',
            '--padding-end': '4px',
            '--color': '#06b6d4',
            '--height': '38px',
            '--min-height': '38px',
            fontSize: '22px'
          }}
        >
          <IonIcon icon={attach} />
        </IonButton>

        <div style={{
          flex: 1,
          backgroundColor: 'white',
          borderRadius: '20px',
          border: '1.5px solid rgba(6, 182, 212, 0.3)',
          overflow: 'hidden',
          boxShadow: '0 1px 4px rgba(6, 182, 212, 0.1)',
          display: 'flex',
          alignItems: 'center'
        }}>
          <IonTextarea
            ref={textareaRef}
            value={messageText}
            onIonInput={(e) => onTextChange(e.detail.value || '')}
            onIonFocus={onFocus}
            placeholder="Nachricht schreiben..."
            autoGrow
            rows={1}
            autocapitalize="sentences"
            style={{
              '--background': 'transparent',
              '--border-radius': '0',
              '--padding-start': '14px',
              '--padding-end': '14px',
              '--padding-top': '10px',
              '--padding-bottom': '10px',
              '--box-shadow': 'none',
              margin: '0',
              '--color': '#1a1a1a',
              '--placeholder-color': '#8e8e93',
              minHeight: '38px'
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />
        </div>

        <IonButton
          fill="solid"
          shape="round"
          size="small"
          disabled={(!messageText.trim() && !selectedFile) || uploading}
          onClick={onSend}
          style={{
            '--background': '#06b6d4',
            '--background-activated': '#0891b2',
            '--background-hover': '#0891b2',
            '--height': '38px',
            '--min-height': '38px',
            '--border-radius': '19px',
            '--padding-start': '0',
            '--padding-end': '0',
            '--box-shadow': '0 2px 8px rgba(6, 182, 212, 0.35)',
            minWidth: '38px',
            maxWidth: '38px',
            fontSize: '15px'
          }}
        >
          {uploading ? <IonSpinner name="dots" /> : <IonIcon icon={send} />}
        </IonButton>

        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={onFileSelect}
          accept="image/*,video/*,.pdf,.doc,.docx,.txt"
        />
      </div>
    </IonToolbar>
  </IonFooter>
));

// --- Camera/Gallery Helpers ---

interface CameraResult {
  file: File;
  previewUrl: string;
}

export const takePicture = async (): Promise<CameraResult | null> => {
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
    quality: 90
  });
  if (!photo.dataUrl) return null;
  const response = await fetch(photo.dataUrl);
  const blob = await response.blob();
  const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
  if (file.size > 10 * 1024 * 1024) return null;
  return { file, previewUrl: photo.dataUrl };
};

export const selectFromGallery = async (): Promise<CameraResult | null> => {
  const photo = await Camera.getPhoto({
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Photos,
    quality: 90
  });
  if (!photo.dataUrl) return null;
  const response = await fetch(photo.dataUrl);
  const blob = await response.blob();
  const file = new File([blob], 'gallery-photo.jpg', { type: 'image/jpeg' });
  if (file.size > 10 * 1024 * 1024) return null;
  return { file, previewUrl: photo.dataUrl };
};

// Auto-capitalize function for text input
export const autoCapitalize = (value: string): string => {
  if (!value) return '';
  if (value.length === 1) return value.toUpperCase();

  const lastTwoChars = value.slice(-3, -1);
  if ((lastTwoChars.endsWith('. ') || lastTwoChars.endsWith('? ') || lastTwoChars.endsWith('! '))) {
    const newChar = value.slice(-1);
    if (newChar !== newChar.toUpperCase() && /[a-z\u00e4\u00f6\u00fc]/.test(newChar)) {
      return value.slice(0, -1) + newChar.toUpperCase();
    }
  }

  return value;
};

// MIME extension map for file handling
export const MIME_EXT_MAP: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'application/pdf': 'pdf', 'text/plain': 'txt',
  'application/msword': 'doc', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt', 'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx'
};
