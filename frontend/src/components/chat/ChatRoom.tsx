import React, { useState, useEffect, useRef } from 'react';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonTextarea,
  IonFooter,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  useIonModal,
  useIonAlert
} from '@ionic/react';
import {
  arrowBack,
  send,
  attach,
  barChart,
  people,
  returnUpBack,
  closeCircle
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import { useBadge } from '../../contexts/BadgeContext';
import api from '../../services/api';
import { initializeWebSocket, getSocket, joinRoom, leaveRoom, disconnectWebSocket } from '../../services/websocket';
import { Message, Reaction, ChatRoomProps as ChatRoomComponentProps } from '../../types/chat';
import { formatFileSize } from '../../utils/helpers';
import MessageBubble from './MessageBubble';
import PollModal from './modals/PollModal';
import MembersModal from './modals/MembersModal';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileViewer } from '@capacitor/file-viewer';
import { FileOpener } from '@capacitor-community/file-opener';



const ChatRoom: React.FC<ChatRoomComponentProps> = ({ room, onBack, presentingElement }) => {
  const { user, setError, setSuccess, markChatRoomAsRead } = useApp();
  const { refreshFromAPI } = useBadge();
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionTargetMessage, setReactionTargetMessage] = useState<Message | null>(null);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLIonTextareaElement>(null);
  const scrollPositionRef = useRef<number>(0);


  // Open image with FileOpener (like Activity Requests)
  const openImageWithFileOpener = async (filePath: string) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
      
      // Download with authentication
      const response = await api.get(`/chat/files/${filePath}`, {
        responseType: 'blob'
      });
      
      const blob = response.data;
      const safeFileName = `chat_${filePath.substring(0, 8)}.jpg`;
      
      // Convert to base64
      const base64Data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.readAsDataURL(blob);
      });
      
      // Ensure temp directory exists
      try {
        await Filesystem.mkdir({
          path: 'temp',
          directory: Directory.Documents,
          recursive: true
        });
      } catch (e) {
        // Directory might already exist
      }
      
      // Write file
      const path = `temp/${safeFileName}`;
      await Filesystem.writeFile({
        path,
        data: base64Data,
        directory: Directory.Documents
      });
      
      // Get file URI
      const fileUri = await Filesystem.getUri({
        directory: Directory.Documents,
        path
      });
      
      // Open with FileOpener
      await FileOpener.open({
        filePath: fileUri.uri,
        contentType: 'image/jpeg'
      });
    } catch (error) {
 console.error('Error opening image:', error);
      setError('Fehler beim Öffnen des Bildes');
    }
  };

  // Hooks müssen vor conditional returns stehen!
  const [presentAlert] = useIonAlert();

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

  // Load messages on mount and setup WebSocket for real-time updates
  useEffect(() => {
    if (!room?.id) return;
    loadMessages();
    markRoomAsRead();

    // WebSocket: Join room and listen for new messages
    const token = localStorage.getItem('konfi_token');
    if (token) {
      const socket = initializeWebSocket(token);

      // Join room when connected (or immediately if already connected)
      // WICHTIG: socket.on statt socket.once - damit bei JEDEM Reconnect joinRoom aufgerufen wird!
      const handleConnect = () => {
        joinRoom(room.id);
      };

      if (socket.connected) {
        joinRoom(room.id);
      }
      socket.on('connect', handleConnect);

      // Listen for new messages
      socket.on('newMessage', (data: { roomId: number; message: any }) => {
        if (data.roomId === room.id) {
 console.log('WebSocket: New message received');
          setMessages(prev => {
            // Avoid duplicates
            if (prev.some(m => m.id === data.message.id)) return prev;
            return [...prev, data.message];
          });
        }
      });

      // Listen for deleted messages
      socket.on('messageDeleted', (data: { roomId: number; messageId: number }) => {
        if (data.roomId === room.id) {
 console.log('WebSocket: Message deleted');
          setMessages(prev => prev.map(m =>
            m.id === data.messageId ? { ...m, deleted_at: new Date().toISOString() } : m
          ));
        }
      });

      // Listen for typing indicators
      socket.on('userTyping', (data: { roomId: number; userId: number; userName: string }) => {
        if (data.roomId === room.id && data.userId !== user?.id) {
          // Could show typing indicator here
 console.log(`${data.userName} is typing...`);
        }
      });

      // Listen for reaction added
      socket.on('reactionAdded', (data: { roomId: number; messageId: number; reaction: Reaction }) => {
        if (data.roomId === room.id) {
          setMessages(prev => prev.map(m => {
            if (m.id !== data.messageId) return m;
            const reactions = m.reactions || [];
            // Avoid duplicates
            if (reactions.some(r => r.id === data.reaction.id)) return m;
            return { ...m, reactions: [...reactions, data.reaction] };
          }));
        }
      });

      // Listen for reaction removed
      socket.on('reactionRemoved', (data: { roomId: number; messageId: number; userId: number; userType: string; emoji: string }) => {
        if (data.roomId === room.id) {
          setMessages(prev => prev.map(m => {
            if (m.id !== data.messageId) return m;
            return {
              ...m,
              reactions: (m.reactions || []).filter(r =>
                !(r.user_id === data.userId && r.user_type === data.userType && r.emoji === data.emoji)
              )
            };
          }));
        }
      });
    }

    // Fallback: 30-second polling als Backup (falls WebSocket ausfaellt)
    const interval = setInterval(async () => {
      await loadMessages();
    }, 30000);

    return () => {
      clearInterval(interval);
      if (room?.id) {
        leaveRoom(room.id);
      }
      const socket = getSocket();
      if (socket) {
        socket.off('connect');
        socket.off('newMessage');
        socket.off('messageDeleted');
        socket.off('userTyping');
        socket.off('reactionAdded');
        socket.off('reactionRemoved');
      }
    };
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
    // Always scroll to bottom on initial load or new messages
    if (contentRef.current && messages.length > 0) {
      if (isInitialLoad) {
        // Initial load - scroll immediately without animation
        setTimeout(() => {
          contentRef.current?.scrollToBottom(0);
        }, 50);
        setIsInitialLoad(false);
      } else if (shouldAutoScroll && messages.length > prevMessageCountRef.current) {
        // New message - smooth scroll
        contentRef.current.scrollToBottom(300);
      }
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, shouldAutoScroll, isInitialLoad]);

  const loadMessages = async () => {
    // Kein eigener Loading State - ChatRoomView handled das Loading
    if (!room) return;
    try {
      const response = await api.get(`/chat/rooms/${room.id}/messages?limit=100`);
      setMessages(response.data);
      
      // Don't pre-load images anymore - use lazy loading instead for better performance
    } catch (err) {
      setError('Fehler beim Laden der Nachrichten');
 console.error('Error loading messages:', err);
    } finally {
      // Loading wird im ChatRoomView gehandhabt
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
 console.log('Uploading file:', selectedFile.name, selectedFile.size, selectedFile.type);
      }
      // Reply-Referenz hinzufügen wenn vorhanden
      if (replyToMessage) {
        formData.append('reply_to', replyToMessage.id.toString());
      }

      // Debug: Check what we're sending
 console.log('FormData contents:', {
        hasContent: !!messageText.trim(),
        hasFile: !!selectedFile,
        fileName: selectedFile?.name,
        fileSize: selectedFile?.size,
        replyTo: replyToMessage?.id
      });

      await api.post(`/chat/rooms/${room.id}/messages`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      // Force multipart/form-data content type for file uploads

      setMessageText('');
      setReplyToMessage(null); // Reset reply after sending
      clearSelectedFile();

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

  const deleteMessage = (messageId: number) => {
    presentAlert({
      header: 'Nachricht löschen?',
      message: 'Diese Nachricht unwiderruflich löschen?',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Löschen',
          role: 'destructive',
          handler: () => {
            api.delete(`/chat/messages/${messageId}`)
              .then(() => {
                loadMessages();
                setSuccess('Nachricht gelöscht');
              })
              .catch((err) => {
                setError('Fehler beim Löschen der Nachricht');
 console.error('Error deleting message:', err);
              });
          }
        }
      ]
    });
  };

  // Reaktion hinzufügen/entfernen
  const toggleReaction = async (messageId: number, emoji: string) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
      setShouldAutoScroll(false);

      const response = await api.post(`/chat/messages/${messageId}/reactions`, { emoji });

      // Optimistic update - direkt im State aktualisieren
      setMessages(prev => prev.map(msg => {
        if (msg.id !== messageId) return msg;

        const reactions = msg.reactions || [];
        if (response.data.action === 'added') {
          // Prüfe ob Reaktion schon existiert (verhindert Duplikate durch WebSocket)
          const alreadyExists = reactions.some(r =>
            r.user_id === user!.id && r.user_type === user!.type && r.emoji === emoji
          );
          if (alreadyExists) return msg;

          // Reaktion hinzufügen
          return {
            ...msg,
            reactions: [...reactions, {
              id: response.data.id,
              emoji,
              user_id: user!.id,
              user_type: user!.type as 'admin' | 'konfi',
              user_name: user!.display_name || ''
            }]
          };
        } else {
          // Reaktion entfernen
          return {
            ...msg,
            reactions: reactions.filter(r =>
              !(r.user_id === user!.id && r.user_type === user!.type && r.emoji === emoji)
            )
          };
        }
      }));

      setShowReactionPicker(false);
      setReactionTargetMessage(null);
      setTimeout(() => setShouldAutoScroll(true), 500);
    } catch (err) {
      setError('Fehler beim Reagieren');
 console.error('Error toggling reaction:', err);
      setShouldAutoScroll(true);
    }
  };

  // Reaktion-Picker öffnen
  const openReactionPicker = (message: Message) => {
    setReactionTargetMessage(message);
    setShowReactionPicker(true);
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
 console.log('File selected:', file ? `${file.name} (${file.size} bytes, ${file.type})` : 'No file');
    if (file) {
      if (file.size > 10 * 1024 * 1024) { // 10MB limit
        setError('Datei ist zu groß (max. 10MB)');
        return;
      }
      setSelectedFile(file);

      // Create preview URL for images
      if (file.type.startsWith('image/')) {
        const previewUrl = URL.createObjectURL(file);
        setSelectedFilePreview(previewUrl);
      } else {
        setSelectedFilePreview(null);
      }
 console.log('File set as selectedFile');
    }
  };

  // Cleanup preview URL on unmount or file change
  useEffect(() => {
    return () => {
      if (selectedFilePreview) {
        URL.revokeObjectURL(selectedFilePreview);
      }
    };
  }, [selectedFilePreview]);

  // Handle textarea focus to preserve scroll position on Android
  const handleTextareaFocus = async () => {
    // Save current scroll position before keyboard opens
    if (contentRef.current) {
      const scrollElement = await contentRef.current.getScrollElement();
      scrollPositionRef.current = scrollElement.scrollTop;

      // After keyboard animation completes, restore scroll position
      // Android keyboard animation takes ~300ms
      setTimeout(async () => {
        if (contentRef.current && scrollPositionRef.current > 0) {
          const scrollEl = await contentRef.current.getScrollElement();
          // Only restore if we were scrolled down and now we're at top
          if (scrollEl.scrollTop < scrollPositionRef.current * 0.5) {
            scrollEl.scrollTop = scrollPositionRef.current;
          }
        }
      }, 350);
    }
  };

  // Auto-capitalize function for text input
  const handleTextInputChange = (value: string) => {
    if (!value) {
      setMessageText('');
      return;
    }

    // Auto-capitalize first letter of new message
    if (value.length === 1) {
      setMessageText(value.toUpperCase());
      return;
    }

    // Auto-capitalize after period, question mark, exclamation mark followed by space
    const lastTwoChars = value.slice(-3, -1);
    if ((lastTwoChars.endsWith('. ') || lastTwoChars.endsWith('? ') || lastTwoChars.endsWith('! '))) {
      const newChar = value.slice(-1);
      if (newChar !== newChar.toUpperCase() && /[a-zäöü]/.test(newChar)) {
        setMessageText(value.slice(0, -1) + newChar.toUpperCase());
        return;
      }
    }

    setMessageText(value);
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
        setSelectedFilePreview(photo.dataUrl); // Set preview directly from dataUrl
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
        setSelectedFilePreview(photo.dataUrl); // Set preview directly from dataUrl
      }
    } catch (error) {
 console.error('Gallery error:', error);
      setError('Galerie-Zugriff fehlgeschlagen');
    }
  };

  const clearSelectedFile = () => {
    if (selectedFilePreview) {
      URL.revokeObjectURL(selectedFilePreview);
    }
    setSelectedFile(null);
    setSelectedFilePreview(null);
  };

  const handleLongPress = async (message: Message) => {
    try {
      // Native haptic feedback
      await Haptics.impact({ style: ImpactStyle.Medium });

      // Toggle selection - zeige Inline-Aktionsleiste
      if (selectedMessage?.id === message.id) {
        setSelectedMessage(null);
        setShowReactionPicker(false);
      } else {
        setSelectedMessage(message);
        setShowReactionPicker(false);
      }
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

  const handleShareMessage = (message: Message) => {
    setSelectedMessage(message);
    handleShare();
  };

  const handleImageOrFileClick = async (filePath: string) => {
    const fileName = filePath.split('/').pop() || 'file';
    if (fileName.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
      await openImageWithFileOpener(filePath);
    } else if (fileName.match(/\.(pdf|doc|docx|txt|xls|xlsx|ppt|pptx)$/i)) {
      try {
        await Haptics.impact({ style: ImpactStyle.Medium });
        const response = await api.get(`/chat/files/${filePath}`, {
          responseType: 'blob'
        });
        const blob = response.data;
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
        const fileUri = await Filesystem.getUri({
          directory: Directory.Documents,
          path
        });
        await FileViewer.openDocumentFromLocalPath({
          path: fileUri.uri
        });
      } catch (viewerError) {
        console.warn('Native viewer failed, using fallback:', viewerError);
        const fileUrl = `${api.defaults.baseURL}/chat/files/${filePath}`;
        window.open(fileUrl, '_blank');
      }
    } else {
      const fileUrl = `${api.defaults.baseURL}/chat/files/${filePath}`;
      window.open(fileUrl, '_blank');
    }
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

      <IonContent
        ref={contentRef}
        className="app-gradient-background"
        fullscreen
        onClick={() => {
          if (selectedMessage || showReactionPicker) {
            setSelectedMessage(null);
            setShowReactionPicker(false);
            setReactionTargetMessage(null);
          }
        }}
      >
        <IonRefresher slot="fixed" onIonRefresh={(e) => {
          loadMessages();
          e.detail.complete();
        }}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        <div style={{ paddingBottom: '120px' }}>
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              room={room}
              user={user}
              selectedMessage={selectedMessage}
              showReactionPicker={showReactionPicker}
              reactionTargetMessage={reactionTargetMessage}
              onLongPress={handleLongPress}
              onReply={setReplyToMessage}
              onShare={handleShareMessage}
              onDelete={deleteMessage}
              onToggleReaction={toggleReaction}
              onOpenReactionPicker={openReactionPicker}
              onVoteInPoll={voteInPoll}
              onImageClick={handleImageOrFileClick}
              onError={setError}
              onDeselectMessage={() => setSelectedMessage(null)}
              textareaRef={textareaRef}
            />
          ))}
        </div>
      </IonContent>
      <IonFooter style={{ backgroundColor: 'rgba(248, 249, 250, 0.95)', backdropFilter: 'blur(10px)' }}>
        {/* Reply Preview */}
        {replyToMessage && (
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
              onClick={() => setReplyToMessage(null)}
              style={{ '--padding-start': '4px', '--padding-end': '4px' }}
            >
              <IonIcon icon={closeCircle} style={{ fontSize: '1.2rem', color: '#8e8e93' }} />
            </IonButton>
          </div>
        )}

        {/* File Preview - direkt an Input angehängt wie Reply */}
        {selectedFile && (
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
                  src={selectedFilePreview}
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
              onClick={clearSelectedFile}
              style={{ '--padding-start': '6px', '--padding-end': '6px' }}
            >
              <IonIcon icon={closeCircle} style={{ fontSize: '1.4rem', color: '#8e8e93' }} />
            </IonButton>
          </div>
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
                onIonInput={(e) => handleTextInputChange(e.detail.value || '')}
                onIonFocus={handleTextareaFocus}
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
                    sendMessage();
                  }
                }}
              />
            </div>

            <IonButton
              fill="solid"
              shape="round"
              size="small"
              disabled={(!messageText.trim() && !selectedFile) || uploading}
              onClick={sendMessage}
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
              onChange={handleFileSelect}
              accept="image/*,video/*,.pdf,.doc,.docx,.txt"
            />
          </div>
        </IonToolbar>
      </IonFooter>


    </>
  );
};

export default ChatRoom;