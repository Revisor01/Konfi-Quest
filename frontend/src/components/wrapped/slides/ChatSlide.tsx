import React from 'react';
import { IonIcon } from '@ionic/react';
import { chatbubblesOutline } from 'ionicons/icons';
import type { SlideProps, KonfiChatSlide } from '../../../types/wrapped';
import { useCountUp } from '../../../hooks/useCountUp';
import SlideBase from './SlideBase';

interface ChatSlideProps extends SlideProps {
  chat: KonfiChatSlide;
}

const ChatSlide: React.FC<ChatSlideProps> = ({ isActive, chat }) => {
  const animatedCount = useCountUp(chat.nachrichten_gesendet, isActive);

  return (
    <SlideBase isActive={isActive} className="chat-slide">
      <div className="wrapped-anim-fade" style={{ opacity: 0 }}>
        <p className="wrapped-subtitle">Im Chat</p>
      </div>
      <div className="wrapped-anim-scale wrapped-anim-delay-1" style={{ opacity: 0 }}>
        <p className="wrapped-big-number">{animatedCount}</p>
        <p className="wrapped-subtitle">Nachrichten gesendet</p>
      </div>
      <div className="wrapped-anim-fade wrapped-anim-delay-2" style={{ opacity: 0 }}>
        <div className="chat-decoration">
          <IonIcon icon={chatbubblesOutline} style={{ fontSize: '3rem', color: 'rgba(124,58,237,0.5)' }} />
        </div>
      </div>
    </SlideBase>
  );
};

export default ChatSlide;
