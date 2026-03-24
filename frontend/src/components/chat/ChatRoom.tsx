import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  useIonModal,
  useIonAlert,
  useIonActionSheet
} from '@ionic/react';
import {
  arrowBack
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import { useBadge } from '../../contexts/BadgeContext';
import { useOfflineQuery } from '../../hooks/useOfflineQuery';
import { CACHE_TTL } from '../../services/offlineCache';
import api from '../../services/api';
import { initializeWebSocket, getSocket, joinRoom, leaveRoom, disconnectWebSocket, onReconnect } from '../../services/websocket';
import { getToken } from '../../services/tokenStore';
import { Message, Reaction, PollVote, ChatRoomProps as ChatRoomComponentProps } from '../../types/chat';
import MessageBubble from './MessageBubble';
import PollModal from './modals/PollModal';
import MembersModal from './modals/MembersModal';
import FileViewerModal, { FileItem } from '../shared/FileViewerModal';
// Camera is now handled via ChatRoomSections helpers
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Share } from '@capacitor/share';
import { Filesystem, Directory } from '@capacitor/filesystem';
// Native FileViewer ueber openFileNatively, FileViewerModal als Web-Fallback
import { openFileNatively } from '../../utils/nativeFileViewer';
import { writeQueue } from '../../services/writeQueue';
import { networkMonitor } from '../../services/networkMonitor';
import { ChatHeader, MessageInput, autoCapitalize, MIME_EXT_MAP, takePicture as takePictureHelper, selectFromGallery as selectFromGalleryHelper } from './ChatRoomSections';
import { triggerPullHaptic } from '../../utils/haptics';



const ChatRoom: React.FC<ChatRoomComponentProps> = ({ room, onBack, presentingElement }) => {
  const { user, setError, setSuccess, isOnline } = useApp();
  const { markRoomAsRead: badgeMarkRoomAsRead, refreshAllCounts } = useBadge();

  // --- useOfflineQuery: Initial messages load mit Cache ---
  const { data: initialMessages, refresh: refreshMessagesCache } = useOfflineQuery<Message[]>(
    'chat:messages:' + room?.id,
    () => api.get(`/chat/rooms/${room?.id}/messages?limit=100`).then(r => r.data),
    { ttl: CACHE_TTL.CHAT_MESSAGES, enabled: !!room?.id }
  );

  // Lokaler messages-State für Live-Updates (WebSocket aktualisiert diesen direkt)
  const [messages, setMessages] = useState<Message[]>([]);

  // Initiale Nachrichten aus Cache/API in lokalen State kopieren
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

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
  const viewerRef = useRef<{ files: FileItem[]; initialIndex: number }>({ files: [], initialIndex: 0 });


  // Hooks müssen vor conditional returns stehen!
  const [presentAlert] = useIonAlert();
  const [presentActionSheet] = useIonActionSheet();

  const handleRetryMessage = (message: Message) => {
    presentActionSheet({
      header: 'Nachricht fehlgeschlagen',
      buttons: [
        {
          text: 'Erneut senden',
          handler: async () => {
            // Message als pending markieren
            setMessages(prev => prev.map(m =>
              m.localId === message.localId ? { ...m, queueStatus: 'pending' as const } : m
            ));
            // Queue-Item finden und erneut enqueuen
            const queueItems = await writeQueue.getByMetadata({ roomId: room?.id, type: 'chat' });
            const item = queueItems.find(qi => qi.metadata.clientId === message.localId || qi.id === message.localId);
            if (item) {
              await writeQueue.remove(item.id);
              const retryItem = { ...item, retryCount: 0 };
              // retryCount/id/createdAt werden von enqueue überschrieben, also Omit-kompatibel machen
              await writeQueue.enqueue({
                method: retryItem.method,
                url: retryItem.url,
                body: retryItem.body,
                headers: retryItem.headers,
                maxRetries: retryItem.maxRetries,
                hasFileUpload: retryItem.hasFileUpload,
                metadata: retryItem.metadata,
              });
            }
            // Flush versuchen wenn online
            if (networkMonitor.isOnline) {
              writeQueue.flush();
            }
          }
        },
        {
          text: 'Nachricht l\u00f6schen',
          role: 'destructive',
          handler: async () => {
            // Aus UI entfernen
            setMessages(prev => prev.filter(m => m.localId !== message.localId));
            // Aus Queue entfernen
            const queueItems = await writeQueue.getByMetadata({ roomId: room?.id, type: 'chat' });
            const item = queueItems.find(qi => qi.metadata.clientId === message.localId || qi.id === message.localId);
            if (item) {
              await writeQueue.remove(item.id);
              // Lokale Datei l\u00f6schen falls vorhanden
              if (item.body?._localFilePath) {
                try {
                  await Filesystem.deleteFile({ path: item.body._localFilePath, directory: Directory.Data });
                } catch { /* ignore */ }
              }
            }
          }
        },
        {
          text: 'Abbrechen',
          role: 'cancel'
        }
      ]
    });
  };

  const handleDeleteQueuedMessage = async (message: Message) => {
    // Aus UI entfernen
    setMessages(prev => prev.filter(m => m.localId !== message.localId));
    // Aus Queue entfernen
    const queueItems = await writeQueue.getByMetadata({ roomId: room?.id, type: 'chat' });
    const item = queueItems.find(qi => qi.metadata.clientId === message.localId || qi.id === message.localId);
    if (item) {
      await writeQueue.remove(item.id);
      // Lokale Datei l\u00f6schen falls vorhanden
      if (item.body?._localFilePath) {
        try {
          await Filesystem.deleteFile({ path: item.body._localFilePath, directory: Directory.Data });
        } catch { /* ignore */ }
      }
    }
  };

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

  // FileViewer Modal mit useIonModal Hook (universeller Datei-Viewer)
  const [presentFileViewer, dismissFileViewer] = useIonModal(FileViewerModal, {
    get files() { return viewerRef.current.files; },
    get initialIndex() { return viewerRef.current.initialIndex; },
    onClose: () => {
      dismissFileViewer();
      viewerRef.current.files.forEach(f => {
        if (f.url.startsWith('blob:')) URL.revokeObjectURL(f.url);
      });
      viewerRef.current = { files: [], initialIndex: 0 };
    }
  });

  // Setup WebSocket for real-time updates (initial load via useOfflineQuery)
  useEffect(() => {
    if (!room?.id) return;
    markRoomAsRead();

    // WebSocket: Join room and listen for new messages
    const token = getToken();
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
          setMessages(prev => prev.map(m =>
            m.id === data.messageId ? { ...m, deleted_at: new Date().toISOString() } : m
          ));
        }
      });

      // Listen for typing indicators
      socket.on('userTyping', (data: { roomId: number; userId: number; userName: string }) => {
        if (data.roomId === room.id && data.userId !== user?.id) {
          // Could show typing indicator here
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

  // Ref für aktuelle Messages (verhindert häufige Re-Subscriptions im Reconnect-Effect)
  const messagesRef = useRef<Message[]>(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const loadMissedMessages = async (afterId: number) => {
    if (!room) return;
    try {
      const response = await api.get(`/chat/rooms/${room.id}/messages?after=${afterId}`);
      const missedMessages = response.data;
      if (missedMessages.length > 0) {
        setMessages(prev => [...prev, ...missedMessages]);
      }
    } catch (err) {
      console.error('Fehler beim Nachladen verpasster Nachrichten:', err);
    }
  };

  // Bei Socket-Reconnect verpasste Nachrichten nachladen
  useEffect(() => {
    const unsubReconnect = onReconnect(() => {
      const currentMessages = messagesRef.current;
      if (currentMessages.length > 0) {
        const lastId = currentMessages[currentMessages.length - 1].id;
        loadMissedMessages(lastId);
      } else {
        loadMessages();
      }
    });
    return () => { unsubReconnect(); };
  }, [room?.id]);

  const markRoomAsRead = async () => {
    if (!room) return;
    try {
      // BadgeContext macht optimistisches Update + API Call
      badgeMarkRoomAsRead(room.id);

      // Badge Context neu laden für genaue Counts
      await refreshAllCounts();

    } catch (err) {
      // Silent fail - marking as read is not critical
      console.error('Error marking room as read:', err);
    }
  };

  const sendMessage = async () => {
    if (!messageText.trim() && !selectedFile) return;
    if (!room) return;

    const clientId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const localId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const content = messageText.trim();
    const file = selectedFile;
    const currentReplyTo = replyToMessage;

    // Optimistic UI: Nachricht sofort in messages-State einfuegen
    const optimisticMsg: Message = {
      id: -Date.now(),
      content: content || (file ? file.name : ''),
      sender_id: user?.id ?? 0,
      sender_name: user?.display_name ?? '',
      sender_type: (user?.type || 'konfi') as 'admin' | 'konfi' | 'teamer',
      created_at: new Date().toISOString(),
      message_type: file ? 'image' : 'text',
      file_name: file?.name,
      queueStatus: 'pending',
      localId,
    };

    // UI sofort aktualisieren
    setMessages(prev => [...prev, optimisticMsg]);
    setMessageText('');
    setReplyToMessage(null);
    clearSelectedFile();
    setShouldAutoScroll(true);
    setTimeout(() => contentRef.current?.scrollToBottom(300), 100);

    if (networkMonitor.isOnline) {
      // Online: Normal senden
      setUploading(true);
      try {
        const formData = new FormData();
        if (content) formData.append('content', content);
        if (file) formData.append('file', file);
        if (currentReplyTo) formData.append('reply_to', currentReplyTo.id.toString());
        formData.append('client_id', clientId);

        await api.post(`/chat/rooms/${room.id}/messages`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        // Optimistic msg wird durch WebSocket newMessage Event ersetzt
        setTimeout(() => {
          setMessages(prev => prev.filter(m => m.localId !== localId));
        }, 2000);

        if (room) markRoomAsRead();
        setShouldAutoScroll(true);
        await loadMessages();
      } catch (err) {
        // Bei Fehler: optimistic msg als error markieren
        setMessages(prev => prev.map(m =>
          m.localId === localId ? { ...m, queueStatus: 'error' as const } : m
        ));
      } finally {
        setUploading(false);
      }
    } else {
      // Offline: In Queue schreiben
      let hasFileUpload = false;
      const queueBody: Record<string, any> = { content, client_id: clientId };

      if (file) {
        // Bild lokal speichern
        hasFileUpload = true;
        try {
          const reader = new FileReader();
          const base64 = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          const fileName = `queue_${clientId}_${file.name}`;
          await Filesystem.writeFile({
            path: `queue-uploads/${fileName}`,
            data: base64,
            directory: Directory.Data,
          });
          queueBody._localFilePath = `queue-uploads/${fileName}`;
          queueBody._fileName = file.name;
          queueBody._fileType = file.type;
        } catch (fileErr) {
          console.error('Fehler beim lokalen Speichern der Datei:', fileErr);
          setMessages(prev => prev.map(m =>
            m.localId === localId ? { ...m, queueStatus: 'error' as const } : m
          ));
          return;
        }
      }

      if (currentReplyTo) queueBody.reply_to = currentReplyTo.id.toString();

      await writeQueue.enqueue({
        method: 'POST',
        url: `/chat/rooms/${room.id}/messages`,
        body: queueBody,
        headers: { 'Content-Type': file ? 'multipart/form-data' : 'application/json' },
        maxRetries: 5,
        hasFileUpload,
        metadata: {
          type: 'chat',
          clientId,
          roomId: room.id,
          label: 'Chat-Nachricht',
        },
      });
    }
  };

  const handlePollCreated = async () => {
    await loadMessages();
  };


  const voteInPoll = async (messageId: number, optionIndex: number) => {
    // Offline: Optimistic UI + Queue-Fallback (fire-and-forget)
    if (!networkMonitor.isOnline) {
      setShouldAutoScroll(false);

      // Optimistisch den Vote anzeigen
      setMessages(prev => prev.map(m => {
        if (m.id === messageId && m.votes) {
          const newVote: PollVote = {
            user_id: user?.id ?? 0,
            user_type: (user?.role_name === 'konfi' ? 'konfi' : 'admin') as 'admin' | 'konfi',
            option_index: optionIndex,
          };
          return { ...m, votes: [...m.votes, newVote] };
        }
        return m;
      }));

      writeQueue.enqueue({
        method: 'POST',
        url: `/chat/polls/${messageId}/vote`,
        body: { option_index: optionIndex },
        maxRetries: 3,
        hasFileUpload: false,
        metadata: { type: 'fire-and-forget', clientId: `poll-${messageId}-${optionIndex}-${Date.now()}`, label: 'Abstimmung' },
      });

      setTimeout(() => setShouldAutoScroll(true), 1000);
      return;
    }

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
    if (!isOnline) return;
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
    // Offline: Optimistic UI + Queue-Fallback (fire-and-forget)
    if (!networkMonitor.isOnline) {
      await Haptics.impact({ style: ImpactStyle.Light });
      setShouldAutoScroll(false);

      // Optimistisch toggeln
      setMessages(prev => prev.map(msg => {
        if (msg.id !== messageId) return msg;
        const reactions = msg.reactions || [];
        const existing = reactions.find(r =>
          r.user_id === user!.id && r.user_type === user!.type && r.emoji === emoji
        );
        if (existing) {
          return { ...msg, reactions: reactions.filter(r => r !== existing) };
        }
        return {
          ...msg,
          reactions: [...reactions, {
            id: 0,
            emoji,
            user_id: user!.id,
            user_type: user!.type as 'admin' | 'konfi',
            user_name: user!.display_name || ''
          }]
        };
      }));

      writeQueue.enqueue({
        method: 'POST',
        url: `/chat/messages/${messageId}/reactions`,
        body: { emoji },
        maxRetries: 3,
        hasFileUpload: false,
        metadata: { type: 'fire-and-forget', clientId: `reaction-${messageId}-${emoji}-${Date.now()}`, label: 'Reaktion' },
      });

      setShowReactionPicker(false);
      setReactionTargetMessage(null);
      setTimeout(() => setShouldAutoScroll(true), 500);
      return;
    }

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

  const handleTextInputChange = (value: string) => {
    setMessageText(autoCapitalize(value));
  };

  const takePicture = async () => {
    try {
      const result = await takePictureHelper();
      if (result) {
        if (result.file.size > 10 * 1024 * 1024) {
          setError('Foto ist zu groß (max. 10MB)');
          return;
        }
        setSelectedFile(result.file);
        setSelectedFilePreview(result.previewUrl);
      }
    } catch (error) {
 console.error('Camera error:', error);
      setError('Kamera-Zugriff fehlgeschlagen');
    }
  };

  const selectFromGallery = async () => {
    try {
      const result = await selectFromGalleryHelper();
      if (result) {
        if (result.file.size > 10 * 1024 * 1024) {
          setError('Foto ist zu groß (max. 10MB)');
          return;
        }
        setSelectedFile(result.file);
        setSelectedFilePreview(result.previewUrl);
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
        // For files, share the actual file natively (with auth token)
        const response = await api.get(`/chat/files/${selectedMessage.file_path}`, { responseType: 'blob' });
        const blob = response.data;
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

  const handleFileClick = async (filePath: string, fileName: string, mimeType: string) => {
    try {
      await Haptics.impact({ style: ImpactStyle.Light });

      // Angeklickte Datei als Blob laden
      const response = await api.get(`/chat/files/${filePath}`, { responseType: 'blob' });
      const blob = response.data;
      const mime = response.headers?.['content-type'] || mimeType;

      // Nativ oeffnen versuchen (per D-12)
      const openedNatively = await openFileNatively(blob, fileName, mime);
      if (openedNatively) return;

      // Web-Fallback: FileViewerModal mit Swipe-Kontext
      const blobUrl = URL.createObjectURL(new Blob([blob], { type: mime }));
      const allFileMessages = messages.filter(m => m.file_path);
      const files: FileItem[] = allFileMessages.map(m => {
        if (m.file_path === filePath) {
          return { url: blobUrl, fileName: m.file_name || fileName, mimeType: mime };
        }
        return {
          url: `/api/chat/files/${m.file_path}`,
          fileName: m.file_name || 'Datei',
          mimeType: m.file_name ? getMimeFromFileName(m.file_name) : 'application/octet-stream'
        };
      });
      const clickedIndex = allFileMessages.findIndex(m => m.file_path === filePath);
      viewerRef.current = { files, initialIndex: Math.max(0, clickedIndex) };
      presentFileViewer({ cssClass: 'file-viewer-modal' });
    } catch {
      setError('Fehler beim Öffnen der Datei');
    }
  };

  // MIME-Type aus Dateiname ableiten
  const getMimeFromFileName = (name: string): string => {
    const ext = (name.split('.').pop() || '').toLowerCase();
    const map: Record<string, string> = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
      mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo', webm: 'video/webm', m4v: 'video/mp4',
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    };
    return map[ext] || 'application/octet-stream';
  };

  const canLeaveChat = (): boolean => {
    if (!room) return false;
    // Admins duerfen NIEMALS einen Chat verlassen
    if (user?.type === 'admin') return false;
    // Teamer:innen duerfen group und admin-Chats verlassen
    if (room.type === 'group') return true;
    if (room.type === 'admin') return true;
    return false;
  };

  const handleLeaveChat = () => {
    if (!isOnline) return;
    presentAlert({
      header: 'Chat verlassen',
      message: 'Chat wirklich verlassen? Du erhältst keine Nachrichten mehr aus diesem Chat.',
      buttons: [
        { text: 'Abbrechen', role: 'cancel' },
        {
          text: 'Verlassen',
          role: 'destructive',
          handler: async () => {
            try {
              await api.delete(`/chat/rooms/${room?.id}/leave`);
              onBack();
            } catch {
              setError('Fehler beim Verlassen des Chats');
            }
          }
        }
      ]
    });
  };

  return (
    <>
      <ChatHeader
        roomName={getDisplayRoomName()}
        isAdmin={user?.type === 'admin'}
        canLeave={canLeaveChat()}
        isOnline={isOnline}
        onBack={onBack}
        onOpenMembers={openMembersModal}
        onOpenPoll={openPollModal}
        onLeaveChat={handleLeaveChat}
      />

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
        }} onIonPull={triggerPullHaptic}>
          <IonRefresherContent></IonRefresherContent>
        </IonRefresher>

        {user?.type === 'admin' && room && (room.type === 'group' || room.type === 'admin') && (
          <div style={{
            margin: '8px 16px 0',
            padding: '8px 12px',
            backgroundColor: 'rgba(0,0,0,0.05)',
            borderRadius: '8px',
            fontSize: '0.8rem',
            color: '#666',
            textAlign: 'center'
          }}>
            Admins können Chats nicht verlassen. Chats können nur gelöscht werden.
          </div>
        )}

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
              onFileClick={handleFileClick}
              onError={setError}
              onDeselectMessage={() => setSelectedMessage(null)}
              textareaRef={textareaRef}
              onRetry={handleRetryMessage}
              onDeleteQueued={handleDeleteQueuedMessage}
            />
          ))}
        </div>
      </IonContent>

      <MessageInput
        messageText={messageText}
        uploading={uploading}
        selectedFile={selectedFile}
        selectedFilePreview={selectedFilePreview}
        replyToMessage={replyToMessage}
        textareaRef={textareaRef}
        fileInputRef={fileInputRef}
        onTextChange={handleTextInputChange}
        onFocus={handleTextareaFocus}
        onSend={sendMessage}
        onFileSelect={handleFileSelect}
        onClearFile={clearSelectedFile}
        onClearReply={() => setReplyToMessage(null)}
      />

    </>
  );
};

export default ChatRoom;
