import React, { useState } from 'react';
import { peopleOutline } from 'ionicons/icons';
import { SplitViewShell, useIsWideScreen } from '../../shared';
import AdminKonfisPage from './AdminKonfisPage';
import KonfiDetailView from '../views/KonfiDetailView';

// iPad-Split-View fuer den Admin-Konfis-Bereich.
// Breit (>=lg): Liste links + Konfi-Detail rechts (SplitViewShell).
// Schmal: nur die Liste; Auswahl navigiert per Route /admin/konfis/:id.

const AdminKonfisSplitView: React.FC = () => {
  const [selectedKonfiId, setSelectedKonfiId] = useState<number | null>(null);
  const isWide = useIsWideScreen();

  const handleSelect = (konfiId: number) => {
    if (isWide) {
      setSelectedKonfiId(konfiId);
    } else {
      window.location.assign(`/admin/konfis/${konfiId}`);
    }
  };

  if (!isWide) {
    return <AdminKonfisPage />;
  }

  return (
    <SplitViewShell
      emptyIcon={peopleOutline}
      emptyText="Wähle links einen Konfi aus, um die Details zu sehen."
      master={<AdminKonfisPage onSelectKonfi={handleSelect} selectedKonfiId={selectedKonfiId} />}
      detail={
        selectedKonfiId ? (
          <KonfiDetailView
            key={selectedKonfiId}
            konfiId={selectedKonfiId}
            onBack={() => setSelectedKonfiId(null)}
            hideBackButton
          />
        ) : null
      }
    />
  );
};

export default AdminKonfisSplitView;
