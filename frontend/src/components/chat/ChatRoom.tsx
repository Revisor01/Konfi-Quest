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
  IonFooter,
  IonInput,
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
import { useBadge } from '../../contexts/BadgeContext';
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
  is_deleted?: number; // 1 if deleted, 0 if not
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
  participants?: Array<{
    user_id: number;
    user_type: 'admin' | 'konfi';
    name: string;
    display_name?: string;
  }>;
}

interface ChatRoomProps {
  room: {
    id: number;
    name: string;
    type: 'group' | 'direct' | 'jahrgang' | 'admin';
    participants?: Array<{
      user_id: number;
      user_type: 'admin' | 'konfi';
      name: string;
      display_name?: string;
    }>;
  } | null;
  onBack: () => void;
  presentingElement: HTMLElement | undefined | null;
}

const ChatRoom: React.FC<ChatRoomProps> = ({ room, onBack, presentingElement }) => {
  const { user, setError, setSuccess, markChatRoomAsRead } = useApp();
  const { refreshFromAPI } = useBadge();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageText, setMessageText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hooks müssen vor conditional returns stehen!

  // Poll Modal mit useIonModal Hook (iOS Card Design)
  const [presentPollModalHook, dismissPollModalHook] = useIonModal(PollModal, {
    onClose: () => dismissPollModalHook(),
    onSuccess: () => {
      dismissPollModalHook();
      handlePollCreated();
    },
    roomId: room?.id ?? 0 // ?? statt || für klarere Intention
  });
  
  const openPollModal = () => {
    if (!room) return;
    presentPollModalHook({
      presentingElement: presentingElement || undefined // <-- Verwendet das Prop
    });
  };

  // Members Modal mit useIonModal Hook (iOS Card Design)
  const [presentMembersModalHook, dismissMembersModalHook] = useIonModal(MembersModal, {
    onClose: () => dismissMembersModalHook(),
    onSuccess: () => {
      dismissMembersModalHook();
      loadMessages();
    },
    roomId: room?.id ?? 0,
    roomType: room?.type ?? 'group' 
  });
  
  const openMembersModal = () => {
    if (!room) return;
    presentMembersModalHook({
      presentingElement: presentingElement || undefined // <-- Verwendet das Prop
    });
  };

  // Load messages on mount and setup polling for real-time updates
  useEffect(() => {
    if (!room?.id) return;
    loadMessages();
    markRoomAsRead();
    
    // 5-second polling für Real-time Updates - aber OHNE Auto-Scroll
    const interval = setInterval(async () => {
      // Store current message count to prevent auto-scroll
      const currentCount = messages.length;
      await loadMessages();
      // prevMessageCountRef wird vom useEffect für Scroll-Logic verwendet
    }, 5000);
    
    return () => clearInterval(interval);
  }, [room?.id]);

  // Mark as read only when new messages arrive (not every 5 seconds)
  useEffect(() => {
    if (messages.length > 0) {
      markRoomAsRead();
    }
  }, [messages.length]);


  // Track previous message count to only scroll on NEW messages
  const prevMessageCountRef = useRef(0);
  
  useEffect(() => {
    // Only scroll if we actually have new messages (not just reloads)
    if (contentRef.current && shouldAutoScroll && messages.length > prevMessageCountRef.current) {
      contentRef.current.scrollToBottom(300);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, shouldAutoScroll]);

  const loadMessages = async () => {
    // Kein eigener Loading State - ChatRoomView handled das Loading
    if (!room) return;
    try {
      const response = await api.get(`/chat/rooms/${room.id}/messages?limit=100`);
      setMessages(response.data);
    } catch (err) {
      setError('Fehler beim Laden der Nachrichten');
      console.error('Error loading messages:', err);
    } finally {
      setLoading(false); // Nur für den Fall, dass es gesetzt war
    }
  };

  const markRoomAsRead = async () => {
    if (!room) return;
    try {
      await api.post(`/chat/rooms/${room.id}/mark-read`);
      // Update global chat notifications state
      markChatRoomAsRead(room.id);
      
      // Einfach: Badge Context neu laden für genaue Counts
      await refreshFromAPI();
      
      console.log('Room marked as read:', room.id);
    } catch (err) {
      // Silent fail - marking as read is not critical
      console.error('Error marking room as read:', err);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() && !selectedFile) return;
    if (!room) return;

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
      
      // Mark as read BEFORE loading messages to prevent badge increment
      if (room) markRoomAsRead();
      
      // Force scroll to bottom after sending message
      setShouldAutoScroll(true);
      await loadMessages();
      
      // Ensure scroll to bottom after message is loaded
      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.scrollToBottom(300);
        }
      }, 100);
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
        
        if (!response.ok) {
          throw new Error(`File download failed: ${response.status}`);
        }
        
        const blob = await response.blob();
        const fileName = selectedMessage.file_name || 'file';
        
        // Convert blob to base64 with proper error handling
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            if (result) {
              const base64 = result.split(',')[1];
              resolve(base64);
            } else {
              reject(new Error('Failed to convert file to base64'));
            }
          };
          reader.onerror = () => reject(new Error('FileReader error'));
          reader.readAsDataURL(blob);
        });
        
        // Create MIME type for the file
        const mimeType = response.headers.get('content-type') || 'application/octet-stream';
        
        // iOS requires base64 data URLs instead of file:// URLs
        // This solves the -10814 NSOSStatusErrorDomain error
        const dataUrl = `data:${mimeType};base64,${base64Data}`;
        
        console.log('Sharing data URL with MIME type:', mimeType);
        
        try {
          await Share.share({
            title: 'Datei aus Konfi Quest',
            text: selectedMessage.content || fileName,
            url: dataUrl,
            dialogTitle: 'Datei teilen'
          });
        } catch (shareError) {
          console.error('Base64 share failed, trying remote URL:', shareError);
          // Fallback: Share remote URL directly
          await Share.share({
            title: 'Datei aus Konfi Quest',
            text: `${selectedMessage.content || fileName}\n\nDatei: ${fileUrl}`,
            url: fileUrl,
            dialogTitle: 'Datei teilen'
          });
        }
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

  const getDisplayRoomName = () => {
      if (!room) return 'Chat wird geladen...';
      if (room.type === 'direct' && room.participants) {
        const otherParticipant = room.participants.find(p => 
          !(p.user_id === user?.id && p.user_type === user?.type)
        );
        if (otherParticipant) {
          return otherParticipant.display_name || otherParticipant.name || 'Unbekannt';
        }
      }
      return room.name || 'Chat';
    };

  // Early return nach allen Hooks wenn room noch nicht geladen ist
  if (!room) {
    return (
      <>
        <IonHeader translucent={true}>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={onBack}>
                <IonIcon icon={arrowBack} />
              </IonButton>
            </IonButtons>
            <IonTitle>Chat wird geladen...</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="app-gradient-background" fullscreen>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Chat wird geladen...</p>
          </div>
        </IonContent>
      </>
    );
  }

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
              {(message.sender_name || 'U').charAt(0).toUpperCase()}
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
              {message.sender_name || 'Unbekannter User'}
            </div>
          )}
          
          {message.is_deleted ? (
            <div style={{
              fontStyle: 'italic',
              opacity: 0.6,
              color: isOwnMessage ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.5)'
            }}>
              🗑️ {message.content}
            </div>
          ) : message.message_type === 'poll' && message.question && message.options ? (
            <div style={{
              background: 'rgba(128, 128, 128, 0.1)',
              borderRadius: '16px',
              padding: '20px',
              marginTop: '8px',
              border: '1px solid rgba(128, 128, 128, 0.2)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
            }}>
              <div style={{ 
                fontWeight: '600', 
                marginBottom: '16px',
                fontSize: '1.1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: isOwnMessage ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.9)'
              }}>
                <span style={{
                  fontSize: '1.3rem',
                  color: isOwnMessage ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)'
                }}>
                  📊
                </span>
                {message.question}
              </div>
              
              {message.expires_at && (
                <div style={{
                  fontSize: '0.85rem',
                  opacity: 0.8,
                  marginBottom: '16px',
                  padding: '8px 12px',
                  background: isOwnMessage 
                    ? 'rgba(255,255,255,0.1)' 
                    : 'rgba(0,0,0,0.05)',
                  borderRadius: '8px',
                  border: `1px solid ${isOwnMessage ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'}`,
                  color: isOwnMessage ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.7)'
                }}>
                  ⏰ Läuft ab: {new Date(message.expires_at).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
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
                  <div key={index} style={{ marginBottom: '10px' }}>
                    <div
                      onClick={() => voteInPoll(message.id, index)}
                      style={{
                        background: userVoted 
                          ? 'linear-gradient(135deg, rgba(76, 175, 80, 0.35) 0%, rgba(76, 175, 80, 0.2) 100%)' 
                          : isOwnMessage 
                            ? 'rgba(255,255,255,0.12)' 
                            : 'rgba(0,0,0,0.06)',
                        border: userVoted 
                          ? '2px solid #4caf50' 
                          : `1px solid ${isOwnMessage ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.15)'}`,
                        borderRadius: '12px',
                        WebkitTapHighlightColor: 'transparent',
                        WebkitTouchCallout: 'none',
                        userSelect: 'none',
                        padding: '14px 16px',
                        cursor: 'pointer',
                        position: 'relative',
                        overflow: 'hidden',
                        transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)',
                        boxShadow: userVoted 
                          ? '0 4px 16px rgba(76, 175, 80, 0.25)' 
                          : '0 2px 8px rgba(0,0,0,0.08)',
                        transform: 'translateZ(0)',
                      }}
                      onMouseEnter={(e) => {
                        const target = e.target as HTMLElement;
                        target.style.transform = 'translateY(-1px)';
                        target.style.boxShadow = userVoted 
                          ? '0 6px 20px rgba(76, 175, 80, 0.3)' 
                          : '0 4px 12px rgba(0,0,0,0.12)';
                      }}
                      onMouseLeave={(e) => {
                        const target = e.target as HTMLElement;
                        target.style.transform = 'translateZ(0)';
                        target.style.boxShadow = userVoted 
                          ? '0 4px 16px rgba(76, 175, 80, 0.25)' 
                          : '0 2px 8px rgba(0,0,0,0.08)';
                      }}
                    >
                      {/* Progress Bar Background */}
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${percentage}%`,
                        background: userVoted 
                          ? 'linear-gradient(90deg, rgba(76, 175, 80, 0.3) 0%, rgba(76, 175, 80, 0.15) 100%)' 
                          : isOwnMessage 
                            ? 'linear-gradient(90deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)'
                            : 'linear-gradient(90deg, rgba(0,0,0,0.06) 0%, rgba(0,0,0,0.03) 100%)',
                        transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                        borderRadius: '10px'
                      }} />
                      
                      {/* Content */}
                      <div style={{ 
                        position: 'relative', 
                        zIndex: 1,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {userVoted && (
                            <div style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '50%',
                              background: 'linear-gradient(45deg, #4caf50, #66bb6a)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: '0 2px 6px rgba(76, 175, 80, 0.4)'
                            }}>
                              <IonIcon 
                                icon={checkmark} 
                                style={{ 
                                  color: 'white',
                                  fontSize: '0.9rem',
                                  fontWeight: 'bold'
                                }} 
                              />
                            </div>
                          )}
                          <span style={{ 
                            fontWeight: userVoted ? '600' : '500',
                            color: isOwnMessage ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.9)',
                            fontSize: '0.95rem'
                          }}>
                            {option}
                          </span>
                        </div>
                        
                        <div style={{ 
                          fontSize: '0.85rem',
                          opacity: 0.85,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: isOwnMessage 
                            ? 'rgba(255,255,255,0.12)' 
                            : 'rgba(0,0,0,0.08)',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          color: isOwnMessage ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)'
                        }}>
                          <span style={{ fontWeight: '600' }}>{optionVotes.length}</span>
                          <span style={{ fontSize: '0.8rem', opacity: 0.9 }}>
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
                marginTop: '16px',
                padding: '12px 16px',
                background: isOwnMessage 
                  ? 'rgba(255,255,255,0.08)' 
                  : 'rgba(0,0,0,0.04)',
                borderRadius: '10px',
                border: `1px solid ${isOwnMessage ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{
                  fontSize: '0.85rem',
                  opacity: 0.8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: isOwnMessage ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)'
                }}>
                  <span style={{ fontSize: '0.9rem' }}>
                    {message.multiple_choice ? '☑️' : '🔘'}
                  </span>
                  <span>
                    {message.multiple_choice ? 'Mehrfachauswahl möglich' : 'Nur eine Antwort'}
                  </span>
                </div>
                <div style={{
                  fontSize: '0.85rem',
                  fontWeight: '600',
                  opacity: 0.9,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  color: isOwnMessage ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.8)'
                }}>
                  <span>👥</span>
                  <span>
                    {message.votes?.length || 0} Stimme{(message.votes?.length || 0) !== 1 ? 'n' : ''} insgesamt
                  </span>
                </div>
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
                        
                        // Write to Cache directory with better error handling
                        const base64Data = await new Promise<string>((resolve, reject) => {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const result = reader.result as string;
                            if (result) {
                              const base64 = result.split(',')[1];
                              resolve(base64);
                            } else {
                              reject(new Error('Failed to convert image to base64'));
                            }
                          };
                          reader.onerror = () => reject(new Error('FileReader error'));
                          reader.readAsDataURL(blob);
                        });
                        
                        const timestamp = Date.now();
                        const uniqueFileName = `${timestamp}_${fileName}`;
                        const path = `temp/${uniqueFileName}`;
                        
                        await Filesystem.writeFile({
                          path,
                          data: base64Data,
                          directory: Directory.Cache,
                          recursive: true
                        });
                        
                        // Get local file URI and open with native viewer
                        const fileUri = await Filesystem.getUri({
                          directory: Directory.Cache,
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
    <>
      <IonHeader translucent={true}>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={onBack}>
              <IonIcon icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>{getDisplayRoomName()}</IonTitle>
          {user?.type === 'admin' && (
            <IonButtons slot="end">
              <IonButton onClick={openMembersModal}>
                <IonIcon icon={people} />
              </IonButton>
              <IonButton onClick={openPollModal}>
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

        <div style={{ paddingBottom: '120px' }}>
          {messages.map(renderMessage)}
        </div>
      </IonContent>

      {/* File Preview außerhalb des Footers für bessere Sichtbarkeit */}
      {selectedFile && (
        <div style={{
          position: 'fixed',
          bottom: '80px', // Oberhalb des Footers
          left: '16px',
          right: '16px',
          backgroundColor: 'var(--ion-color-light-shade, #f8f9fa)',
          border: '1px solid var(--ion-color-step-150, #e0e0e0)',
          borderRadius: '8px',
          padding: '8px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          zIndex: 1000,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}>
          <IonIcon icon={attach} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{selectedFile.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--ion-color-medium)' }}>{formatFileSize(selectedFile.size)}</div>
          </div>
          <IonButton fill="clear" size="small" onClick={() => setSelectedFile(null)}>
            <IonIcon icon={trash} />
          </IonButton>
        </div>
      )}

      <IonFooter>
        <IonToolbar style={{
          '--min-height': 'auto', // Damit es sich an den Inhalt anpasst
          '--padding-start': '16px',
          '--padding-end': '16px'
        }}>
          {/* Dieses DIV ist der Flex-Container für Input und Buttons */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end', // Aligns items to the bottom, useful for autoGrow textarea
            gap: '8px',
            width: '100%' // Wichtig, damit es die volle Breite einnimmt
          }}>

            <IonButton
              fill="clear"
              size="small"
              onClick={() => fileInputRef.current?.click()}
              style={{
                '--padding-start': '0',
                '--padding-end': '0',
                fontSize: '20px' // Attach Icon größer machen
              }}
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
                flex: 1, // Nimmt den restlichen Platz ein
                // '--background': 'var(--ion-color-light-shade, #f8f9fa)',
                '--border-radius': '20px',
                '--padding-start': '12px',
                '--padding-end': '12px',
                '--box-shadow': 'none',
                // Adjust margin-bottom slightly if it conflicts with align-items: flex-end
                marginBottom: '0',
                // Ensure text color is readable on the background
                '--color': 'var(--ion-text-color)'
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
                '--height': '36px',
                '--min-height': '36px',
                '--border-radius': '18px',
                '--padding-start': '0',
                '--padding-end': '0',
                minWidth: '36px',
                maxWidth: '36px',
                fontSize: '14px', // Send Icon kleiner machen
                // Adjust margin-bottom to align with the text area
              }}
            >
              {uploading ? <IonSpinner name="dots" /> : <IonIcon icon={send} />}
            </IonButton>

            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileSelect}
              accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            />
          </div> {/* Ende des Flex-Containers */}
        </IonToolbar>
      </IonFooter>

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
          ...((user?.role_name && ['admin', 'org_admin', 'teamer'].includes(user.role_name)) ? [{
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

    </>
  );
};

export default ChatRoom;