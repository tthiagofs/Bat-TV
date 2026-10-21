package com.thiago.battv;

import android.graphics.Color;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;
import androidx.annotation.OptIn;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.datasource.DefaultHttpDataSource;
import androidx.media3.exoplayer.DefaultLoadControl;
import androidx.media3.exoplayer.DefaultLivePlaybackSpeedControl;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.ui.AspectRatioFrameLayout;
import androidx.media3.ui.PlayerView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NativePlayer")
public class NativePlayerPlugin extends Plugin {

    private ExoPlayer exoPlayer;
    private PlayerView playerView;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private Runnable timeUpdateRunnable;
    private boolean isLiveStream = false;

    @OptIn(markerClass = UnstableApi.class)
    @Override
    public void load() {
        super.load();
        mainHandler.post(this::initPlayerView);
    }

    @OptIn(markerClass = UnstableApi.class)
    private void initPlayerView() {
        if (playerView != null) return;
        try {
            android.view.LayoutInflater inflater = android.view.LayoutInflater.from(getContext());
            playerView = (PlayerView) inflater.inflate(R.layout.player_texture_view, null);
            playerView.setVisibility(View.GONE);
            playerView.setBackgroundColor(Color.TRANSPARENT);

            // Adiciona o PlayerView por trás da WebView do Capacitor
            View webView = getBridge().getWebView();
            ViewGroup parent = (ViewGroup) webView.getParent();
            if (parent != null) {
                int webViewIndex = parent.indexOfChild(webView);
                androidx.coordinatorlayout.widget.CoordinatorLayout.LayoutParams params =
                        new androidx.coordinatorlayout.widget.CoordinatorLayout.LayoutParams(
                                ViewGroup.LayoutParams.MATCH_PARENT,
                                ViewGroup.LayoutParams.MATCH_PARENT
                        );
                parent.addView(playerView, Math.max(0, webViewIndex), params);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @OptIn(markerClass = UnstableApi.class)
    private void setupExoPlayer() {
        if (exoPlayer != null) return;

        DefaultHttpDataSource.Factory httpSourceFactory = new DefaultHttpDataSource.Factory()
                .setUserAgent("IPTVSmarters/1.0.0")
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(15000)
                .setReadTimeoutMs(20000);

        DefaultMediaSourceFactory mediaSourceFactory = new DefaultMediaSourceFactory(getContext())
                .setDataSourceFactory(httpSourceFactory);

        DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
                .setBufferDurationsMs(
                        8000,  // minBufferMs (8s para segurar oscilacoes de rede)
                        25000, // maxBufferMs (25s)
                        2500,  // bufferForPlaybackMs (2.5s para play rapido)
                        4000   // bufferForPlaybackAfterRebufferMs (4s)
                )
                .build();

        DefaultLivePlaybackSpeedControl liveSpeedControl = new DefaultLivePlaybackSpeedControl.Builder()
                .setFallbackMaxPlaybackSpeed(1.05f) // limite suave de 5% de aceleracao (imperceptivel)
                .setFallbackMinPlaybackSpeed(0.97f)
                .setMinUpdateIntervalMs(1000)
                .build();

        exoPlayer = new ExoPlayer.Builder(getContext())
                .setMediaSourceFactory(mediaSourceFactory)
                .setLoadControl(loadControl)
                .setLivePlaybackSpeedControl(liveSpeedControl)
                .build();

        exoPlayer.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                JSObject stateObj = new JSObject();
                switch (playbackState) {
                    case Player.STATE_BUFFERING:
                        stateObj.put("state", "buffering");
                        notifyListeners("stateChange", stateObj);
                        break;
                    case Player.STATE_READY:
                        stateObj.put("state", "ready");
                        long durationMs = exoPlayer.getDuration();
                        stateObj.put("duration", durationMs != C.TIME_UNSET ? (durationMs / 1000.0) : 0);
                        notifyListeners("stateChange", stateObj);
                        startTimeUpdates();
                        break;
                    case Player.STATE_ENDED:
                        stateObj.put("state", "ended");
                        notifyListeners("stateChange", stateObj);
                        stopTimeUpdates();
                        break;
                    case Player.STATE_IDLE:
                        stateObj.put("state", "idle");
                        notifyListeners("stateChange", stateObj);
                        stopTimeUpdates();
                        break;
                }
            }

            @Override
            public void onPlayerError(@NonNull PlaybackException error) {
                JSObject errObj = new JSObject();
                errObj.put("error", error.getMessage() != null ? error.getMessage() : "Erro no ExoPlayer");
                errObj.put("errorCode", error.errorCode);
                notifyListeners("playbackError", errObj);
                stopTimeUpdates();
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                JSObject obj = new JSObject();
                obj.put("isPlaying", isPlaying);
                notifyListeners("isPlayingChange", obj);
            }
        });

        if (playerView != null) {
            playerView.setPlayer(exoPlayer);
        }
    }

    @OptIn(markerClass = UnstableApi.class)
    @PluginMethod
    public void play(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("URL do vídeo inválida");
            return;
        }

        isLiveStream = Boolean.TRUE.equals(call.getBoolean("isLive", false));
        Double startAt = call.getDouble("startAt", 0.0);

        mainHandler.post(() -> {
            try {
                initPlayerView();
                setupExoPlayer();

                if (playerView != null) {
                    playerView.setVisibility(View.VISIBLE);
                    View surface = playerView.getVideoSurfaceView();
                    if (surface instanceof android.view.SurfaceView) {
                        ((android.view.SurfaceView) surface).setZOrderMediaOverlay(false);
                    }
                    playerView.requestLayout();
                }

                // Garante que a janela e a WebView permitam ver o vídeo decodificado pela SurfaceView
                if (getActivity() != null && getActivity().getWindow() != null) {
                    getActivity().getWindow().setBackgroundDrawable(new android.graphics.drawable.ColorDrawable(Color.TRANSPARENT));
                }

                View webView = getBridge().getWebView();
                if (webView != null) {
                    webView.setBackgroundColor(Color.TRANSPARENT);
                    webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
                }

                Uri mediaUri = Uri.parse(url);
                MediaItem mediaItem = MediaItem.fromUri(mediaUri);

                exoPlayer.setMediaItem(mediaItem);
                if (!isLiveStream && startAt != null && startAt > 0) {
                    exoPlayer.seekTo((long) (startAt * 1000));
                }
                exoPlayer.prepare();
                exoPlayer.play();

                call.resolve();
            } catch (Exception e) {
                call.reject("Falha ao iniciar ExoPlayer: " + e.getMessage());
            }
        });
    }

    @PluginMethod
    public void pause(PluginCall call) {
        mainHandler.post(() -> {
            if (exoPlayer != null) {
                exoPlayer.pause();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void resume(PluginCall call) {
        mainHandler.post(() -> {
            if (exoPlayer != null) {
                exoPlayer.play();
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        Double positionSec = call.getDouble("position");
        if (positionSec == null) {
            call.reject("Posição inválida");
            return;
        }

        mainHandler.post(() -> {
            if (exoPlayer != null) {
                exoPlayer.seekTo((long) (positionSec * 1000));
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        Double volume = call.getDouble("volume", 1.0);
        mainHandler.post(() -> {
            if (exoPlayer != null && volume != null) {
                exoPlayer.setVolume(volume.floatValue());
            }
            call.resolve();
        });
    }

    @OptIn(markerClass = UnstableApi.class)
    @PluginMethod
    public void setResizeMode(PluginCall call) {
        String mode = call.getString("mode", "contain");
        mainHandler.post(() -> {
            if (playerView != null) {
                if ("cover".equalsIgnoreCase(mode)) {
                    playerView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_ZOOM);
                } else {
                    playerView.setResizeMode(AspectRatioFrameLayout.RESIZE_MODE_FIT);
                }
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void stop(PluginCall call) {
        mainHandler.post(() -> {
            stopTimeUpdates();
            if (exoPlayer != null) {
                exoPlayer.stop();
                exoPlayer.clearMediaItems();
            }
            if (playerView != null) {
                playerView.setVisibility(View.GONE);
            }
            // Restaura o fundo preto da WebView ao sair do player
            View webView = getBridge().getWebView();
            if (webView != null) {
                webView.setBackgroundColor(Color.BLACK);
            }
            call.resolve();
        });
    }

    @PluginMethod
    public void getPlaybackTime(PluginCall call) {
        mainHandler.post(() -> {
            JSObject ret = new JSObject();
            if (exoPlayer != null) {
                long pos = exoPlayer.getCurrentPosition();
                long dur = exoPlayer.getDuration();
                ret.put("currentTime", pos / 1000.0);
                ret.put("duration", dur != C.TIME_UNSET ? (dur / 1000.0) : 0.0);
                ret.put("isPlaying", exoPlayer.isPlaying());
                ret.put("isBuffering", exoPlayer.getPlaybackState() == Player.STATE_BUFFERING);
            } else {
                ret.put("currentTime", 0.0);
                ret.put("duration", 0.0);
                ret.put("isPlaying", false);
                ret.put("isBuffering", false);
            }
            call.resolve(ret);
        });
    }

    private void startTimeUpdates() {
        stopTimeUpdates();
        timeUpdateRunnable = new Runnable() {
            @Override
            public void run() {
                if (exoPlayer != null && exoPlayer.isPlaying()) {
                    long currentPos = exoPlayer.getCurrentPosition();
                    long duration = exoPlayer.getDuration();
                    JSObject timeObj = new JSObject();
                    timeObj.put("currentTime", currentPos / 1000.0);
                    timeObj.put("duration", duration != C.TIME_UNSET ? (duration / 1000.0) : 0.0);
                    notifyListeners("timeUpdate", timeObj);
                }
                mainHandler.postDelayed(this, 500);
            }
        };
        mainHandler.post(timeUpdateRunnable);
    }

    private void stopTimeUpdates() {
        if (timeUpdateRunnable != null) {
            mainHandler.removeCallbacks(timeUpdateRunnable);
            timeUpdateRunnable = null;
        }
    }

    @Override
    protected void handleOnDestroy() {
        super.handleOnDestroy();
        stopTimeUpdates();
        if (exoPlayer != null) {
            exoPlayer.release();
            exoPlayer = null;
        }
    }
}
