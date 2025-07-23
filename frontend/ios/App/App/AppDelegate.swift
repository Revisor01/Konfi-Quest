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

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Firebase konfigurieren
        FirebaseApp.configure()
        
        // Firebase Messaging Delegate setzen
        Messaging.messaging().delegate = self
        
        // Push Notification Permissions anfordern
        UNUserNotificationCenter.current().delegate = self
        let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
        UNUserNotificationCenter.current().requestAuthorization(options: authOptions) { granted, error in
            print("Push notification permission granted: \(granted)")
            if granted {
                DispatchQueue.main.async {
                    application.registerForRemoteNotifications()
                }
            }
        }
        
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
    func applicationDidBecomeActive(_ application: UIApplication) {}
    func applicationWillTerminate(_ application: UIApplication) {}

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
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
        
        // FCM Token an WebView weiterleiten
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
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
                
                if let bridge = bridgeController {
                    let jsCode = """
                        window.dispatchEvent(new CustomEvent('fcmToken', { 
                            detail: '\(token)' 
                        }));
                    """
                    
                    bridge.bridge?.webView?.evaluateJavaScript(jsCode) { (result, error) in
                        if error == nil {
                            print("✅ FCM Token an WebView übertragen")
                        }
                    }
                }
            }
        }
    }
}
