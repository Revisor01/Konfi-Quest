import React, { useState, useEffect, useRef } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonTextarea,
  IonItem,
  IonLabel,
  IonList,
  IonAvatar,
  IonProgressBar,
  IonChip,
  IonText,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonActionSheet,
  useIonModal
} from '@ionic/react';
import { 
  arrowBack, 
  send, 
  attach, 
  camera, 
  document, 
  image,
  barChart,
  download,
  trash,
  checkmark,
  chatbubbles,
  people,
  images,
  folder,
  chevronForward
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';
import PollModal from './modals/PollModal';
import MembersModal from './modals/MembersModal';
import LoadingSpinner from '../common/LoadingSpinner';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileViewer } from '@capacitor/file-viewer';

interface Message {
  id: number;
  content: string;
  sender_id: number;
  sender_name: string;
  sender_type: 'admin' | 'konfi';
  created_at: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  message_type: 'text' | 'file' | 'poll';
  // Poll-Daten direkt in der Message
  question?: string;
  options?: string[];
  votes?: any[];
  multiple_choice?: boolean;
  expires_at?: string;
  poll_id?: number;
  deleted?: boolean;
}

interface ChatRoom {
  id: number;
  name: string;
  type: 'group' | 'direct' | 'jahrgang' | 'admin';
}

interface ChatRoomProps {
  room: ChatRoom;
  onBack: () => void;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ room, onBack }) => {
  const { user, setError, setSuccess } = useApp();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [presentingElement, setPresentingElement] = useState<HTMLElement | null>(null);

  // Poll Modal mit useIonModal Hook
  const [presentPollModalHook, dismissPollModalHook] = useIonModal(PollModal, {
    onClose: () => dismissPollModalHook(),
    onSuccess: () => {
      dismissPollModalHook();
      handlePollCreated();
    },
    roomId: room.id
  });

  // Members Modal mit useIonModal Hook
  const [presentMembersModalHook, dismissMembersModalHook] = useIonModal(MembersModal, {
    onClose: () => dismissMembersModalHook(),
    onSuccess: () => {
      dismissMembersModalHook();
      loadMessages();
    },
    roomId: room.id,
    roomType: room.type
  });
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLElement>(null);

  useEffect(() => {
    loadMessages();
    markRoomAsRead();
    // Auto-refresh messages every 10 seconds
    const interval = setInterval(() => {
      loadMessages();
      markRoomAsRead();
    }, 10000);
    return () => clearInterval(interval);
  }, [room.id]);

  useEffect(() => {
    // Setze das presentingElement nach dem ersten Mount
    setPresentingElement(pageRef.current);
  }, []);

  useEffect(() => {
    // Scroll to bottom when new messages arrive, but only if auto-scroll is enabled
    if (contentRef.current && shouldAutoScroll) {
      contentRef.current.scrollToBottom(300);
    }
  }, [messages, shouldAutoScroll]);

  const loadMessages = async () => {
    try {
      const response = await api.get(`/chat/rooms/${room.id}/messages?limit=100`);
      setMessages(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Nachrichten');
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false);
    }
  };

  const markRoomAsRead = async () => {
    try {
      await api.post(`/chat/rooms/${room.id}/mark-read`);
      console.log('Room marked as read:', room.id);
    } catch (err) {
      // Silent fail - marking as read is not critical
      console.error('Error marking room as read:', err);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() && !selectedFile) return;

    setUploading(true);
    try {
      const formData = new FormData();
      if (messageText.trim()) {
        formData.append('content', messageText.trim());
      }
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      await api.post(`/chat/rooms/${room.id}/messages`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setMessageText('');
      setSelectedFile(null);
      await loadMessages();
    } catch (err) {
      setError('Fehler beim Senden der Nachricht');
      console.error('Error sending message:', err);
    } finally {
      setUploading(false);
    }
  };

  const handlePollCreated = async () => {
    await loadMessages();
  };


  const voteInPoll = async (messageId: number, optionIndex: number) => {
    try {
      setShouldAutoScroll(false); // Prevent auto-scroll when voting
      await api.post(`/chat/polls/${messageId}/vote`, { option_index: optionIndex });
      await loadMessages();
      // Re-enable auto-scroll after a short delay
      setTimeout(() => setShouldAutoScroll(true), 1000);
    } catch (err) {
      setError('Fehler beim Abstimmen');
      console.error('Error voting in poll:', err);
      setShouldAutoScroll(true); // Re-enable on error
    }
  };

  const deleteMessage = async (messageId: number) => {
    try {
      await api.delete(`/chat/messages/${messageId}`);
      await loadMessages();
      setSuccess('Nachricht gelöscht');
    } catch (err) {
      setError('Fehler beim Löschen der Nachricht');
      console.error('Error deleting message:', err);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('Datei ist zu groß (max. 10MB)');
        return;
      }
      setSelectedFile(file);
    }
  };

  const takePicture = async () => {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        quality: 90
      });

      if (photo.dataUrl) {
        // Convert dataUrl to File
        const response = await fetch(photo.dataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'camera-photo.jpg', { type: 'image/jpeg' });
        
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
          setError('Foto ist zu groß (max. 10MB)');
          return;
        }
        
        setSelectedFile(file);
      }
    } catch (error) {
      console.error('Camera error:', error);
      setError('Kamera-Zugriff fehlgeschlagen');
    }
  };

  const selectFromGallery = async () => {
    try {
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        quality: 90
      });

      if (photo.dataUrl) {
        // Convert dataUrl to File
        const response = await fetch(photo.dataUrl);
        const blob = await response.blob();
        const file = new File([blob], 'gallery-photo.jpg', { type: 'image/jpeg' });
        
        if (file.size > 10 * 1024 * 1024) { // 10MB limit
          setError('Foto ist zu groß (max. 10MB)');
          return;
        }
        
        setSelectedFile(file);
      }
    } catch (error) {
      console.error('Gallery error:', error);
      setError('Galerie-Zugriff fehlgeschlagen');
    }
  };


  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleLongPress = async (message: Message) => {
    try {
      // Native haptic feedback
      await Haptics.impact({ style: ImpactStyle.Medium });
      
      // Show action sheet with options
      setSelectedMessage(message);
      setShowActionSheet(true);
    } catch (error) {
      console.error('Error with long press:', error);
    }
  };

  const handleShare = async () => {
    if (!selectedMessage) return;
    
    try {
      if (selectedMessage.file_path) {
        // For files, share the actual file natively
        const fileUrl = `${api.defaults.baseURL}/chat/files/${selectedMessage.file_path}`;
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        const fileName = selectedMessage.file_name || 'file';
        
        // Write to Documents directory for sharing
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(blob);
        });
        
        const path = `share/${fileName}`;
        await Filesystem.writeFile({
          path,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });
        
        // Get local file URI for sharing
        const fileUri = await Filesystem.getUri({
          directory: Directory.Documents,
          path
        });
        
        await Share.share({
          title: 'Datei aus Konfi Quest',
          text: selectedMessage.content || fileName,
          url: fileUri.uri
        });
      } else {
        // For text messages, share text content
        await Share.share({
          text: selectedMessage.content,
          title: 'Nachricht aus Konfi Quest'
        });
      }
    } catch (error) {
      console.error('Error sharing:', error);
      if (error instanceof Error && error.name !== 'AbortError') {
        setError('Fehler beim Teilen');
      }
    }
  };

  const formatMessageTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString('de-DE', { 
        day: '2-digit', 
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
  };

  const renderMessage = (message: Message) => {
    const isOwnMessage = message.sender_id === user?.id && message.sender_type === user?.type;
    
    if (message.deleted) {
      return (
        <div key={message.id} style={{
          display: 'flex',
          justifyContent: 'center',
          margin: '8px 16px'
        }}>
          <IonText color="medium" style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
            Diese Nachricht wurde gelöscht
          </IonText>
        </div>
      );
    }

    return (
      <div key={message.id} style={{
        display: 'flex',
        flexDirection: isOwnMessage ? 'row-reverse' : 'row',
        margin: '8px 16px',
        alignItems: 'flex-end'
      }}>
        {!isOwnMessage && room.type !== 'direct' && (
          <IonAvatar style={{ 
            width: '32px', 
            height: '32px', 
            marginRight: '8px',
            backgroundColor: message.sender_type === 'admin' ? '#7045f6' : '#3880ff'
          }}>
            <div style={{ 
              color: 'white', 
              fontSize: '0.8rem', 
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%'
            }}>
              {message.sender_name.charAt(0).toUpperCase()}
            </div>
          </IonAvatar>
        )}
        
        <div 
          style={{
            maxWidth: '70%',
            backgroundColor: isOwnMessage ? '#007aff' : '#e9ecef',
            color: isOwnMessage ? 'white' : 'black',
            borderRadius: '16px',
            padding: '12px',
            position: 'relative',
            cursor: 'pointer'
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            handleLongPress(message);
          }}
          onTouchStart={(e) => {
            const timeoutId = setTimeout(() => {
              handleLongPress(message);
            }, 500);
            
            const cleanup = () => {
              clearTimeout(timeoutId);
              e.target.removeEventListener('touchend', cleanup);
              e.target.removeEventListener('touchmove', cleanup);
              e.target.removeEventListener('touchcancel', cleanup);
            };
            
            e.target.addEventListener('touchend', cleanup);
            e.target.addEventListener('touchmove', cleanup);
            e.target.addEventListener('touchcancel', cleanup);
          }}
        >
          {!isOwnMessage && room.type !== 'direct' && (
            <div style={{ 
              fontSize: '0.75rem', 
              fontWeight: 'bold', 
              marginBottom: '4px',
              color: message.sender_type === 'admin' ? '#7045f6' : '#3880ff'
            }}>
              {message.sender_name}
            </div>
          )}
          
          {message.message_type === 'poll' && message.question && message.options ? (
            <div style={{
              background: 'rgba(255,255,255,0.1)',
              borderRadius: '12px',
              padding: '16px',
              marginTop: '8px'
            }}>
              <div style={{ 
                fontWeight: 'bold', 
                marginBottom: '12px',
                fontSize: '1.1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                📊 {message.question}
              </div>
              
              {message.expires_at && (
                <div style={{
                  fontSize: '0.8rem',
                  opacity: 0.7,
                  marginBottom: '12px'
                }}>
                  🕐 Läuft ab: {new Date(message.expires_at).toLocaleString('de-DE')}
                </div>
              )}
              
              {message.options.map((option, index) => {
                // Stimmen für diese Option zählen
                const optionVotes = message.votes?.filter(vote => vote.option_index === index) || [];
                const totalVotes = message.votes?.length || 0;
                const percentage = totalVotes > 0 ? (optionVotes.length / totalVotes) * 100 : 0;
                
                // Prüfen ob aktueller User abgestimmt hat
                const userVoted = message.votes?.some(vote => 
                  vote.user_id === user?.id && 
                  vote.user_type === user?.type && 
                  vote.option_index === index
                );
                
                return (
                  <div key={index} style={{ marginBottom: '8px' }}>
                    <div
                      onClick={() => voteInPoll(message.id, index)}
                      style={{
                        background: userVoted ? 'rgba(40, 167, 69, 0.3)' : 'rgba(255,255,255,0.15)',
                        border: userVoted ? '3px solid #28a745' : '2px solid rgba(255,255,255,0.4)',
                        borderRadius: '8px',
                        padding: '12px',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.2s ease',
                        boxShadow: userVoted ? '0 2px 8px rgba(40, 167, 69, 0.3)' : '0 2px 4px rgba(0,0,0,0.1)'
                      }}
                    >
                      {/* Progress Bar Background */}
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${percentage}%`,
                        backgroundColor: userVoted ? 'rgba(40, 167, 69, 0.3)' : 'rgba(255,255,255,0.15)',
                        transition: 'width 0.3s ease',
                        borderRadius: '6px'
                      }} />
                      
                      {/* Content */}
                      <div style={{ 
                        position: 'relative', 
                        zIndex: 1,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {userVoted && (
                            <IonIcon 
                              icon={checkmark} 
                              style={{ 
                                marginRight: '8px',
                                color: '#28a745',
                                fontSize: '1.2rem'
                              }} 
                            />
                          )}
                          <span style={{ fontWeight: userVoted ? 'bold' : 'normal' }}>
                            {option}
                          </span>
                        </div>
                        
                        <div style={{ 
                          fontSize: '0.9rem',
                          opacity: 0.8,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}>
                          <span>{optionVotes.length}</span>
                          <span style={{ fontSize: '0.8rem' }}>
                            ({percentage.toFixed(0)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              
              {/* Poll Info */}
              <div style={{
                marginTop: '12px',
                fontSize: '0.8rem',
                opacity: 0.7,
                display: 'flex',
                justifyContent: 'space-between'
              }}>
                <span>
                  {message.multiple_choice ? 'Mehrfachauswahl möglich' : 'Nur eine Antwort'}
                </span>
                <span>
                  {message.votes?.length || 0} Stimme{(message.votes?.length || 0) !== 1 ? 'n' : ''}
                </span>
              </div>
            </div>
          ) : message.file_path ? (
            <div>
              {message.content && (
                <div style={{ marginBottom: '8px' }}>{message.content}</div>
              )}
              {message.file_name?.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                // Inline Bild-Anzeige
                <div style={{ marginBottom: '8px' }}>
                  <img 
                    src={`${api.defaults.baseURL}/chat/files/${message.file_path}`}
                    alt={message.file_name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '300px',
                      borderRadius: '8px',
                      objectFit: 'cover',
                      cursor: 'pointer'
                    }}
                    onClick={async () => {
                      try {
                        await Haptics.impact({ style: ImpactStyle.Light });
                        const imageUrl = `${api.defaults.baseURL}/chat/files/${message.file_path}`;
                        
                        // Download image to local storage first
                        const response = await fetch(imageUrl);
                        const blob = await response.blob();
                        const fileName = message.file_name || 'image.jpg';
                        
                        // Write to Documents directory
                        const base64Data = await new Promise<string>((resolve) => {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const base64 = (reader.result as string).split(',')[1];
                            resolve(base64);
                          };
                          reader.readAsDataURL(blob);
                        });
                        
                        const path = `temp/${fileName}`;
                        await Filesystem.writeFile({
                          path,
                          data: base64Data,
                          directory: Directory.Documents,
                          recursive: true
                        });
                        
                        // Get local file URI and open with native viewer
                        const fileUri = await Filesystem.getUri({
                          directory: Directory.Documents,
                          path
                        });
                        
                        await FileViewer.openDocumentFromLocalPath({
                          path: fileUri.uri
                        });
                      } catch (error) {
                        console.error('Error opening image:', error);
                        // Fallback: open image in browser
                        window.open(`${api.defaults.baseURL}/chat/files/${message.file_path}`, '_blank');
                      }
                    }}
                  />
                  <div style={{ fontSize: '0.75rem', opacity: 0.7, marginTop: '4px' }}>
                    {message.file_name} • {message.file_size && formatFileSize(message.file_size)}
                  </div>
                </div>
              ) : (
                // Datei-Anhang für andere Dateitypen
                <div 
                  style={{
                    border: '1px solid rgba(255,255,255,0.3)',
                    borderRadius: '8px',
                    padding: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s ease'
                  }}
                  onClick={async () => {
                    try {
                      await Haptics.impact({ style: ImpactStyle.Medium });
                      const fileUrl = `${api.defaults.baseURL}/chat/files/${message.file_path}`;
                      
                      // Für PDF und andere Dokumente: Native File Viewer verwenden
                      if (message.file_name?.match(/\.(pdf|doc|docx|txt|xls|xlsx|ppt|pptx)$/i)) {
                        try {
                          // Download file to local storage first
                          const response = await fetch(fileUrl);
                          const blob = await response.blob();
                          const fileName = message.file_name || 'document';
                          
                          // Write to Documents directory (not Cache)
                          const base64Data = await new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              const base64 = (reader.result as string).split(',')[1];
                              resolve(base64);
                            };
                            reader.readAsDataURL(blob);
                          });
                          
                          const path = `temp/${fileName}`;
                          await Filesystem.writeFile({
                            path,
                            data: base64Data,
                            directory: Directory.Documents,
                            recursive: true
                          });
                          
                          // Get local file URI and open with native viewer
                          const fileUri = await Filesystem.getUri({
                            directory: Directory.Documents,
                            path
                          });
                          
                          await FileViewer.openDocumentFromLocalPath({
                            path: fileUri.uri
                          });
                        } catch (viewerError) {
                          console.warn('Native viewer failed, using fallback:', viewerError);
                          window.open(fileUrl, '_blank');
                        }
                      } else {
                        // Für andere Dateien: Standard Browser-Download
                        window.open(fileUrl, '_blank');
                      }
                    } catch (error) {
                      console.error('Error opening document:', error);
                      setError('Fehler beim Öffnen der Datei');
                    }
                  }}
                >
                  <IonIcon 
                    icon={message.file_name?.includes('.pdf') ? document : attach} 
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>
                      {message.file_name}
                    </div>
                    {message.file_size && (
                      <div style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                        {formatFileSize(message.file_size)}
                      </div>
                    )}
                  </div>
                  <IonIcon 
                    icon={chevronForward} 
                    style={{ 
                      fontSize: '1.2rem',
                      opacity: 0.7
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div>{message.content}</div>
          )}
          
          <div style={{ 
            fontSize: '0.7rem', 
            opacity: 0.7, 
            marginTop: '4px',
            textAlign: 'right'
          }}>
            {formatMessageTime(message.created_at)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <IonPage ref={pageRef}>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onBack}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>{room.name}</IonTitle>
          {user?.type === 'admin' && (
            <IonButtons slot="end">
              <IonButton onClick={() => presentMembersModalHook()}>
                <IonIcon icon={people} />
              </IonButton>
              <IonButton onClick={() => presentPollModalHook()}>
                <IonIcon icon={barChart} />
              </IonButton>
            </IonButtons>
          )}
        </IonToolbar>
      </IonHeader>
      
      <IonContent ref={contentRef} className="app-gradient-background" fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadMessages();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {loading ? (
          <LoadingSpinner message="Nachrichten werden geladen..." />
        ) : (
          <div style={{ paddingBottom: '120px' }}>
            {messages.map(renderMessage)}
          </div>
        )}
      </IonContent>

      {/* Message Input */}
      <div style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        borderTop: '1px solid #e0e0e0',
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        zIndex: 1000
      }}>
        {selectedFile && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: '16px',
            right: '16px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #e0e0e0',
            borderRadius: '8px',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <IonIcon icon={attach} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{selectedFile.name}</div>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>{formatFileSize(selectedFile.size)}</div>
            </div>
            <IonButton fill="clear" size="small" onClick={() => setSelectedFile(null)}>
              <IonIcon icon={trash} />
            </IonButton>
          </div>
        )}
        
        <IonButton 
          fill="clear" 
          size="small"
          onClick={() => fileInputRef.current?.click()}
        >
          <IonIcon icon={attach} />
        </IonButton>
        
        
        <IonTextarea
          value={messageText}
          onIonInput={(e) => setMessageText(e.detail.value!)}
          placeholder="Nachricht schreiben..."
          autoGrow
          rows={1}
          style={{
            flex: 1,
            '--background': '#f8f9fa',
            '--border-radius': '20px',
            '--padding-start': '12px',
            '--padding-end': '12px'
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        
        <IonButton 
          fill="solid" 
          shape="round"
          size="small"
          disabled={(!messageText.trim() && !selectedFile) || uploading}
          onClick={sendMessage}
          style={{
            '--height': '28px',
            '--min-height': '28px',
            '--border-radius': '14px',
            '--padding-start': '6px',
            '--padding-end': '6px',
            minWidth: '28px',
            maxWidth: '28px',
            fontSize: '14px'
          }}
        >
          {uploading ? <IonSpinner /> : <IonIcon icon={send} />}
        </IonButton>
        
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          accept="image/*,video/*,.pdf,.doc,.docx,.txt"
        />
      </div>



      {/* Action Sheet für Longpress */}
      <IonActionSheet
        isOpen={showActionSheet}
        onDidDismiss={() => {
          setShowActionSheet(false);
          setSelectedMessage(null);
        }}
        buttons={[
          {
            text: 'Teilen',
            icon: 'share-outline',
            handler: () => {
              handleShare();
            }
          },
          ...(user?.type === 'admin' ? [{
            text: 'Löschen',
            icon: 'trash-outline',
            role: 'destructive' as const,
            handler: () => {
              if (selectedMessage) {
                deleteMessage(selectedMessage.id);
              }
            }
          }] : []),
          {
            text: 'Abbrechen',
            icon: 'close-outline',
            role: 'cancel' as const
          }
        ]}
      />

    </IonPage>
  );
};

export default ChatRoom;