package com.thiago.battv;

import android.app.UiModeManager;
import android.content.pm.PackageManager;
import android.content.res.Configuration;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativePlayerPlugin.class);
        super.onCreate(savedInstanceState);

        // Força aceleração por hardware na janela
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED
        );

        // Configura a janela para suportar transparência sobre a Surface de vídeo nativa
        getWindow().setFormat(android.graphics.PixelFormat.TRANSLUCENT);
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // Detecta se o dispositivo é uma TV (Android TV, Fire Stick, TCL, etc.) vs Tablet/Celular
        UiModeManager uiModeManager = (UiModeManager) getSystemService(UI_MODE_SERVICE);
        boolean isTelevision = uiModeManager != null && uiModeManager.getCurrentModeType() == Configuration.UI_MODE_TYPE_TELEVISION;
        boolean hasLeanback = getPackageManager().hasSystemFeature(PackageManager.FEATURE_LEANBACK);
        boolean isFireTV = Build.MODEL != null && (Build.MODEL.startsWith("AFT") || (Build.MANUFACTURER != null && Build.MANUFACTURER.equalsIgnoreCase("Amazon")));
        boolean isTclTV = (Build.MODEL != null && Build.MODEL.toUpperCase().contains("TCL")) || (Build.MANUFACTURER != null && Build.MANUFACTURER.toUpperCase().contains("TCL"));
        final boolean isTvDevice = isTelevision || hasLeanback || isFireTV || isTclTV;

        if (bridge != null && bridge.getWebView() != null) {
            WebView webView = bridge.getWebView();
            webView.setBackgroundColor(Color.TRANSPARENT);
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
            settings.setCacheMode(WebSettings.LOAD_DEFAULT);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                settings.setOffscreenPreRaster(true);
            }
            webView.setWebChromeClient(new WebChromeClient());

            // Informa a web view se é um dispositivo de TV para ligar o modo de ultra desempenho
            webView.post(new Runnable() {
                @Override
                public void run() {
                    if (bridge != null && bridge.getWebView() != null) {
                        bridge.getWebView().evaluateJavascript(
                            "window.__IS_ANDROID_TV__ = " + isTvDevice + "; " +
                            "if (window.__applyTvPerformanceMode) { window.__applyTvPerformanceMode(" + isTvDevice + "); }",
                            null
                        );
                    }
                }
            });
        }
    }

    private long lastBackPressTime = 0;

    @Override
    public void onBackPressed() {
        if (bridge != null && bridge.getWebView() != null) {
            // Verifica se há modal ativo, diálogo ou player na tela para fechar primeiro
            bridge.getWebView().evaluateJavascript(
                "(function() {" +
                "  var modal = document.querySelector('[data-tv-modal=\"true\"], [role=\"dialog\"], [data-tv-player=\"true\"]');" +
                "  if (modal) {" +
                "    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));" +
                "    return true;" +
                "  }" +
                "  var evt = new CustomEvent('tvHardwareBack', { cancelable: true });" +
                "  var dispatched = window.dispatchEvent(evt);" +
                "  return !dispatched;" +
                "})();",
                new android.webkit.ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String value) {
                        if ("true".equals(value)) {
                            // Modal, player ou aba manipulou a ação de voltar, não fecha o app
                            return;
                        }
                        long now = System.currentTimeMillis();
                        if (now - lastBackPressTime < 2500) {
                            MainActivity.super.onBackPressed();
                        } else {
                            lastBackPressTime = now;
                            android.widget.Toast.makeText(MainActivity.this, "Pressione Voltar novamente para sair do BAT TV", android.widget.Toast.LENGTH_SHORT).show();
                        }
                    }
                }
            );
        } else {
            super.onBackPressed();
        }
    }
}
