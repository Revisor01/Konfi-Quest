-- Sichere Bereinigung der alten Tabellen nach erfolgreicher Migration

BEGIN TRANSACTION;

-- Prüfe dass alle Konfis migriert wurden
SELECT 'Verification before cleanup:' as status;
SELECT 
  (SELECT COUNT(*) FROM konfis) as old_konfis_count,
  (SELECT COUNT(*) FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'konfi') as new_konfis_count;

-- Entferne die alte konfis Tabelle
DROP TABLE IF EXISTS konfis;

-- Falls noch eine admins Tabelle existiert, entferne sie auch
DROP TABLE IF EXISTS admins;

COMMIT;

-- Finale Verifikation
SELECT 'Cleanup completed. Final state:' as status;
SELECT 
  (SELECT COUNT(*) FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'admin') as admin_users,
  (SELECT COUNT(*) FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'konfi') as konfi_users,
  (SELECT COUNT(*) FROM konfi_profiles) as konfi_profiles;

-- Zeige dass alte Tabellen weg sind
SELECT name FROM sqlite_master WHERE type='table' AND name IN ('konfis', 'admins');