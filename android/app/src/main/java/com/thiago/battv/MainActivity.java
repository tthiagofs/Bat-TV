package com.thiago.battv;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
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

        // Configura a janela para suportar transparência sobre a Surface de vídeo nativa
        getWindow().setFormat(android.graphics.PixelFormat.TRANSLUCENT);
        getWindow().setBackgroundDrawable(new ColorDrawable(Color.TRANSPARENT));
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        if (bridge != null && bridge.getWebView() != null) {
            WebView webView = bridge.getWebView();
            webView.setBackgroundColor(Color.TRANSPARENT);
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            WebSettings settings = webView.getSettings();
            settings.setMediaPlaybackRequiresUserGesture(false);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            webView.setWebChromeClient(new WebChromeClient());
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
