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
  IonActionSheet,
  IonAlert,
  IonProgressBar,
  IonChip,
  IonText,
  IonSpinner,
  IonRefresher,
  IonRefresherContent
} from '@ionic/react';
import { 
  arrowBack, 
  send, 
  attach, 
  camera, 
  document, 
  image,
  bar_chart,
  ellipsisVertical,
  download,
  trash,
  checkmark
} from 'ionicons/icons';
import { useApp } from '../../contexts/AppContext';
import api from '../../services/api';

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
  poll_data?: {
    question: string;
    options: string[];
    votes: number[];
    user_vote?: number;
    multiple_choice: boolean;
  };
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
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [showPollAlert, setShowPollAlert] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const contentRef = useRef<HTMLIonContentElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadMessages();
    // Auto-refresh messages every 10 seconds
    const interval = setInterval(loadMessages, 10000);
    return () => clearInterval(interval);
  }, [room.id]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    if (contentRef.current) {
      contentRef.current.scrollToBottom(300);
    }
  }, [messages]);

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

  const createPoll = async () => {
    if (!pollQuestion.trim() || pollOptions.filter(opt => opt.trim()).length < 2) {
      setError('Bitte geben Sie eine Frage und mindestens 2 Antwortmöglichkeiten ein');
      return;
    }

    try {
      const pollData = {
        question: pollQuestion.trim(),
        options: pollOptions.filter(opt => opt.trim()),
        multiple_choice: false
      };

      await api.post(`/chat/rooms/${room.id}/polls`, pollData);
      
      setPollQuestion('');
      setPollOptions(['', '']);
      setShowPollAlert(false);
      setSuccess('Umfrage erstellt');
      await loadMessages();
    } catch (err) {
      setError('Fehler beim Erstellen der Umfrage');
      console.error('Error creating poll:', err);
    }
  };

  const voteInPoll = async (messageId: number, optionIndex: number) => {
    try {
      await api.post(`/chat/polls/${messageId}/vote`, { option_index: optionIndex });
      await loadMessages();
    } catch (err) {
      setError('Fehler beim Abstimmen');
      console.error('Error voting in poll:', err);
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
        {!isOwnMessage && (
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
        
        <div style={{
          maxWidth: '70%',
          backgroundColor: isOwnMessage ? '#007aff' : '#e9ecef',
          color: isOwnMessage ? 'white' : 'black',
          borderRadius: '16px',
          padding: '12px',
          position: 'relative'
        }}>
          {!isOwnMessage && (
            <div style={{ 
              fontSize: '0.75rem', 
              fontWeight: 'bold', 
              marginBottom: '4px',
              color: message.sender_type === 'admin' ? '#7045f6' : '#3880ff'
            }}>
              {message.sender_name}
            </div>
          )}
          
          {message.message_type === 'poll' && message.poll_data ? (
            <div>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                📊 {message.poll_data.question}
              </div>
              {message.poll_data.options.map((option, index) => {
                const votes = message.poll_data!.votes[index] || 0;
                const totalVotes = message.poll_data!.votes.reduce((sum, v) => sum + v, 0);
                const percentage = totalVotes > 0 ? (votes / totalVotes) * 100 : 0;
                const userVoted = message.poll_data!.user_vote === index;
                
                return (
                  <div key={index} style={{ marginBottom: '4px' }}>
                    <IonButton
                      fill="clear"
                      size="small"
                      onClick={() => voteInPoll(message.id, index)}
                      style={{
                        '--color': isOwnMessage ? 'white' : 'black',
                        width: '100%',
                        textAlign: 'left',
                        justifyContent: 'flex-start',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        height: '100%',
                        width: `${percentage}%`,
                        backgroundColor: userVoted ? '#28a745' : 'rgba(255,255,255,0.2)',
                        transition: 'width 0.3s ease'
                      }} />
                      <div style={{ position: 'relative', zIndex: 1 }}>
                        {userVoted && <IonIcon icon={checkmark} style={{ marginRight: '8px' }} />}
                        {option} ({votes})
                      </div>
                    </IonButton>
                  </div>
                );
              })}
            </div>
          ) : message.file_path ? (
            <div>
              {message.content && (
                <div style={{ marginBottom: '8px' }}>{message.content}</div>
              )}
              <div style={{
                border: '1px solid rgba(255,255,255,0.3)',
                borderRadius: '8px',
                padding: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <IonIcon 
                  icon={message.file_name?.includes('.pdf') ? document : 
                       message.file_name?.match(/\.(jpg|jpeg|png|gif)$/i) ? image : attach} 
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
                <IonButton
                  fill="clear"
                  size="small"
                  onClick={() => window.open(`${api.defaults.baseURL}/chat/files/${message.file_path}`, '_blank')}
                >
                  <IonIcon icon={download} />
                </IonButton>
              </div>
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
          
          {user?.type === 'admin' && (
            <IonButton
              fill="clear"
              size="small"
              style={{
                position: 'absolute',
                top: '-8px',
                right: '-8px',
                width: '24px',
                height: '24px',
                '--color': isOwnMessage ? 'white' : 'black'
              }}
              onClick={() => deleteMessage(message.id)}
            >
              <IonIcon icon={trash} style={{ fontSize: '0.8rem' }} />
            </IonButton>
          )}
        </div>
      </div>
    );
  };

  return (
    <IonPage>
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
              <IonButton onClick={() => setShowActionSheet(true)}>
                <IonIcon icon={ellipsisVertical} />
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
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <IonSpinner />
          </div>
        ) : (
          <div style={{ paddingBottom: '80px' }}>
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
          disabled={(!messageText.trim() && !selectedFile) || uploading}
          onClick={sendMessage}
        >
          {uploading ? <IonSpinner /> : <IonIcon icon={send} />}
        </IonButton>
        
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          accept="image/*,.pdf,.doc,.docx,.txt"
        />
      </div>

      {/* Admin Action Sheet */}
      <IonActionSheet
        isOpen={showActionSheet}
        onDidDismiss={() => setShowActionSheet(false)}
        buttons={[
          {
            text: 'Umfrage erstellen',
            icon: bar_chart,
            handler: () => setShowPollAlert(true)
          },
          {
            text: 'Abbrechen',
            role: 'cancel'
          }
        ]}
      />

      {/* Poll Creation Alert */}
      <IonAlert
        isOpen={showPollAlert}
        onDidDismiss={() => setShowPollAlert(false)}
        header="Neue Umfrage"
        inputs={[
          {
            name: 'question',
            type: 'text',
            placeholder: 'Frage eingeben...',
            value: pollQuestion,
            handler: (input) => setPollQuestion(input.value)
          },
          {
            name: 'option1',
            type: 'text',
            placeholder: 'Antwort 1',
            value: pollOptions[0],
            handler: (input) => setPollOptions([input.value, pollOptions[1]])
          },
          {
            name: 'option2',
            type: 'text',
            placeholder: 'Antwort 2',
            value: pollOptions[1],
            handler: (input) => setPollOptions([pollOptions[0], input.value])
          }
        ]}
        buttons={[
          {
            text: 'Abbrechen',
            role: 'cancel'
          },
          {
            text: 'Erstellen',
            handler: createPoll
          }
        ]}
      />
    </IonPage>
  );
};

export default ChatRoom;