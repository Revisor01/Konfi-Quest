import UIKit
import Capacitor
import FirebaseCore
import FirebaseMessaging
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate {

    var window: UIWindow?
    
    // HIER: Statische Variable, um den Token zu speichern
    static var fcmToken: String?
    static var tokenSentToServer: Bool = false

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Firebase konfigurieren
        FirebaseApp.configure()
        
        // Firebase Messaging Delegate setzen
        Messaging.messaging().delegate = self
        
        // Push Notification Delegate setzen (Permission wird nach Login angefordert)
        UNUserNotificationCenter.current().delegate = self
        
        // FCM Token wird automatisch über Delegate empfangen
        
        return true
    }

    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
        Messaging.messaging().apnsToken = deviceToken
        NotificationCenter.default.post(name: .capacitorDidRegisterForRemoteNotifications, object: deviceToken)
    }

    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
        NotificationCenter.default.post(name: .capacitorDidFailToRegisterForRemoteNotifications, object: error)
    }

    // ... (applicationWillResignActive etc. bleiben unverändert) ...

    func applicationWillResignActive(_ application: UIApplication) {}
    func applicationDidEnterBackground(_ application: UIApplication) {}
    func applicationWillEnterForeground(_ application: UIApplication) {}
    func applicationDidBecomeActive(_ application: UIApplication) {
        // Token nur einmal pro App-Session abrufen, wenn noch nicht vorhanden
        if AppDelegate.fcmToken == nil || !AppDelegate.tokenSentToServer {
            retrieveAndSendFCMToken()
        }
    }
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }
    
    // MARK: - Push Permission Request (called after login)
    func requestPushPermissionsAfterLogin() {
        UNUserNotificationCenter.current().delegate = self
        let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
        UNUserNotificationCenter.current().requestAuthorization(options: authOptions) { granted, error in
            print("✅ Push permission request after login - granted: \(granted)")
            if granted {
                DispatchQueue.main.async {
                    UIApplication.shared.registerForRemoteNotifications()
                    // Token wird automatisch über MessagingDelegate empfangen
                }
            } else {
                print("❌ Push permissions denied after login")
            }
        }
    }
    
    // MARK: - FCM Token Retrieval
    private func retrieveAndSendFCMToken() {
        // Token aus Firebase abrufen
        Messaging.messaging().token { [weak self] token, error in
            if let error = error {
                print("❌ Error fetching FCM token: \(error)")
                return
            }
            
            guard let token = token else {
                print("❌ FCM token is nil")
                return
            }
            
            print("✅ Retrieved FCM token: \(token.prefix(20))...")
            
            // Token in statischer Variable speichern
            AppDelegate.fcmToken = token
            
            // Token an WebView senden
            self?.sendTokenToWebView(token: token)
        }
    }
    
    private func sendTokenToWebView(token: String) {
        // Prüfen ob Token bereits an Server gesendet wurde
        if AppDelegate.tokenSentToServer {
            print("ℹ️ Token bereits an Server gesendet, überspringe WebView Event")
            return
        }
        
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.0) { // Längere Verzögerung für WebView readiness
            if let window = UIApplication.shared.windows.first,
               let rootController = window.rootViewController {
                
                var bridgeController: CAPBridgeViewController?
                
                if let bridge = rootController as? CAPBridgeViewController {
                    bridgeController = bridge
                } else if let navController = rootController as? UINavigationController,
                          let bridge = navController.viewControllers.first as? CAPBridgeViewController {
                    bridgeController = bridge
                } else if let bridge = rootController.children.first as? CAPBridgeViewController {
                    bridgeController = bridge
                }
                
                if let bridge = bridgeController, let webView = bridge.bridge?.webView {
                    let jsCode = """
                        if (window.dispatchEvent) {
                            window.dispatchEvent(new CustomEvent('fcmToken', { 
                                detail: '\(token)' 
                            }));
                            console.log('✅ FCM Token Event dispatched');
                        } else {
                            console.log('❌ dispatchEvent not available');
                        }
                    """
                    
                    webView.evaluateJavaScript(jsCode) { (result, error) in
                        if error == nil {
                            print("✅ FCM Token an WebView übertragen")
                            AppDelegate.tokenSentToServer = true
                        } else {
                            print("❌ Fehler beim Übertragen des FCM Tokens: \(error?.localizedDescription ?? "Unknown")")
                        }
                    }
                } else {
                    print("⚠️ WebView noch nicht bereit, wiederhole in 1 Sekunde...")
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
                        self.sendTokenToWebView(token: token)
                    }
                }
            }
        }
    }

}

// MARK: - MessagingDelegate
extension AppDelegate: MessagingDelegate {
    func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
        guard let token = fcmToken else {
            print("❌ Firebase FCM token is nil")
            return
        }
        
        print("✅ Firebase FCM token received: \(token)")
        
        // WICHTIG: Den korrekten Token hier in der statischen Variable speichern
        AppDelegate.fcmToken = token
        
        // Bei Token Refresh immer senden (neuer Token!)
        AppDelegate.tokenSentToServer = false
        sendTokenToWebView(token: token)
    }
}
