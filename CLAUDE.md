# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KonfipointsNew (Konfi Quest) is a modern web-based management system for confirmation points in the evangelical church. This is a clean project structure with React 19 + TypeScript + Ionic 8 frontend and Express.js backend.

## Project Structure

```
KonfipointsNew/
├── frontend/          # React 19 + TypeScript + Ionic 8 frontend
├── backend/           # Express.js API server
├── API Definitionen.md # Complete API specification
├── docker-compose.yml # Container orchestration
└── CLAUDE.md         # This file
```

## Architecture

### Frontend (React 19 + Ionic 8 + TypeScript)
- **Main Framework**: React 19 with TypeScript and Ionic React 8 for mobile-first UI
- **Build Tool**: Vite 5.2 with TypeScript support
- **Mobile Platform**: Capacitor 7.4 for iOS deployment
- **State Management**: React Context API (`AppContext`) for global state
- **Entry Point**: `src/App.tsx` → Tab-based navigation for admin and konfi users
- **Testing**: Vitest for unit tests, Cypress for E2E tests
- **Linting**: ESLint 9.x with TypeScript ESLint

### Backend (Node.js + Express)
- **API Server**: Express.js with JWT authentication
- **Database**: SQLite3 for data persistence
- **Authentication**: Two-tier system (admin/konfi) with biblical password generation
- **File Uploads**: Multer for image handling
- **Port**: 5000 (exposed as 8623 in Docker)
- **API Base URL**: https://konfipoints.godsapp.de/api

### Key Components Structure
- `frontend/src/components/admin/`: Admin dashboard and management views
- `frontend/src/components/konfi/`: Konfi (confirmation student) views  
- `frontend/src/components/auth/`: Authentication components
- `frontend/src/components/chat/`: Chat functionality (planned)
- `frontend/src/components/common/`: Shared UI components
- `frontend/src/services/`: API service layer with axios
- `frontend/src/contexts/`: React Context providers
- `frontend/src/hooks/`: Custom React hooks (planned)

## Development Commands

### Frontend Development
```bash
cd frontend
npm run dev              # Vite development server (port 5173)
npm run build            # TypeScript compilation and Vite build
npm run preview          # Preview production build
npm run lint             # ESLint check
npm run test.unit        # Vitest unit tests  
npm run test.e2e         # Cypress E2E tests
```

### iOS Development
```bash
cd frontend
npm run build && npx cap sync ios  # Build and sync with Xcode
# Then open and build in Xcode manually
```

### Backend Development
```bash
cd backend
npm start              # Production server
npm run dev            # Development with nodemon
```

### Docker Operations (Backend Only)
```bash
docker-compose up -d          # Start backend server
docker-compose up --build -d  # Rebuild and start backend
docker-compose down           # Stop backend service
```

## Key Technical Details

### Authentication System
- Admin login: `admin` / `pastor2025`
- Konfi passwords: Generated biblical references (e.g., `Johannes3,16`)
- JWT tokens with role-based access (`admin` vs `konfi`)
- Auto-detection login: tries admin first, then konfi

### API Integration
- **Base URL**: https://konfipoints.godsapp.de/api
- **Auth Token Example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwidHlwZSI6ImFkbWluIiwiZGlzcGxheV9uYW1lIjoiUGFzdG9yIFNpbW9uIEx1dGhlIiwiaWF0IjoxNzUyMzUzOTM3LCJleHAiOjE3NTM1NjM1Mzd9.StuYdxqfGwrmykmKBu6G7G3EaTtW2ydJvnWfOFjXpEU`
- **Test Command**: `curl -H "Authorization: Bearer <token>" https://konfipoints.godsapp.de/api/badges`
- **JWT Handling**: Automatic token injection via axios interceptors
- **Error Handling**: 401 responses automatically redirect to login

### Database Schema
- SQLite database with tables for konfis, activities, badges, jahrgaenge (year groups)
- Foreign key relationships between konfis and their activities/points
- Admin tracking for point assignments

### Mobile Integration
- Capacitor 7.4 plugins for app functionality
- iOS-specific configuration in `frontend/ios/` directory
- Ionic 8 setupIonicReact with iOS mode by default

### State Management
- `AppContext` provides global state for user authentication
- Loading states managed per data type
- Error/success message handling with auto-clear timers

## Important Files

### Configuration
- `frontend/capacitor.config.ts`: Capacitor/iOS configuration
- `frontend/package.json`: Dependencies including React 19, Ionic 8, TypeScript
- `frontend/vite.config.ts`: Build configuration
- `frontend/eslint.config.js`: Linting rules
- `frontend/cypress.config.ts`: E2E testing configuration
- `frontend/ionic.config.json`: Ionic project configuration
- `backend/package.json`: Backend dependencies and scripts
- `backend/server.js`: Main API server with all endpoints

### Core Components
- `frontend/src/App.tsx`: Main app with tab navigation
- `frontend/src/contexts/AppContext.tsx`: Global state management
- `frontend/src/services/api.ts`: Axios-based API service with auth interceptors
- `frontend/src/services/auth.ts`: Authentication service with auto-detection

## Git Branch Strategy
- Currently on `ios` branch for iOS-specific development
- Main development focus on clean implementation

## Testing
- **Unit Tests**: Vitest with @testing-library/react
- **E2E Tests**: Cypress configured for localhost:5173
- **Command**: `npm run test.unit` or `npm run test.e2e`

## Common Development Patterns

### Code Style
- Use TypeScript strict mode
- Leverage Ionic 8 components for UI consistency
- Follow React 19 patterns and hooks
- Use Axios interceptors for API communication
- Prefer functional components with hooks

### API Communication
- All API calls through centralized `api.ts` service
- JWT tokens automatically injected via interceptors
- Error handling with context-based messaging
- Auto-redirect on 401 unauthorized responses

## Ionic Modal Implementation Pattern

### Korrekte IonModal Backdrop Implementation

Für Modals mit korrektem Backdrop-Verhalten muss folgendes Pattern verwendet werden:

**1. Parent Component (Page-Level):**
```tsx
// WICHTIG: Parent Component muss IonPage verwenden!
const ParentPage: React.FC = () => {
  const pageRef = React.useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <IonPage ref={pageRef}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Page Title</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="app-gradient-background" fullscreen>
        {/* Page Content */}
      </IonContent>
      
      {/* Modal */}
      <IonModal 
        isOpen={isModalOpen} 
        onDidDismiss={() => setIsModalOpen(false)}
        presentingElement={pageRef.current || undefined}
        canDismiss={true}
        backdropDismiss={true}
      >
        <ModalComponent onClose={() => setIsModalOpen(false)} />
      </IonModal>
    </IonPage>
  );
};
```

**2. Modal Component:**
```tsx
// Modal Component muss IonPage innerhalb des Modals verwenden
const ModalComponent: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Modal Title</IonTitle>
          <IonButtons slot="start">
            <IonButton onClick={onClose}>Abbrechen</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {/* Modal Content */}
      </IonContent>
    </IonPage>
  );
};
```

**Kritische Punkte:**
- Parent Component MUSS `IonPage` als Root-Element verwenden
- `pageRef` ist essentiell für `presentingElement`
- Modal Component verwendet `IonPage` innerhalb des `IonModal`
- `presentingElement={pageRef.current || undefined}` aktiviert das Backdrop

## API Reference

Comprehensive API documentation is available in `API Definitionen.md` including:
- Authentication endpoints
- Konfi management (CRUD operations)
- Activity and badge systems
- Chat functionality
- Admin management tools
- File upload handling
- Bonus points system

## Development Language
- **Primary Language**: German for all development communication
- **Code Comments**: Write in German
- **Variable Names**: Can be English/German mix as appropriate
- **Documentation**: German preferred

## Git Commit Guidelines
- Standard commit messages without AI attribution
- Focus on clear, descriptive commit messages in German
- No requirement to mention Claude or AI assistance