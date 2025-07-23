#import <Foundation/Foundation.h>
#import <Capacitor/Capacitor.h>

// Definiere den Plugin für Capacitor
CAP_PLUGIN(FCMPlugin, "FCM",
           CAP_PLUGIN_METHOD(getFCMToken, CAPPluginReturnPromise);
)