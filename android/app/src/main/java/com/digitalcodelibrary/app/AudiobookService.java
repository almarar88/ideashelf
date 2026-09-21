package com.digitalcodelibrary.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import androidx.media.session.MediaButtonReceiver;

import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;

/**
 * Reads a book aloud from a foreground service.
 *
 * The WebView's JavaScript is suspended when the app goes to the background or the screen
 * turns off, so narration driven from the page dies there. Everything needed to keep
 * reading — the page texts or the audio URLs, the position, the speech engine — therefore
 * lives here, in a service the system keeps alive, with lock-screen and notification
 * controls like any other audio player.
 */
public class AudiobookService extends Service {

    public static final String ACTION_START = "dcl.audiobook.START";
    public static final String ACTION_PLAY = "dcl.audiobook.PLAY";
    public static final String ACTION_PAUSE = "dcl.audiobook.PAUSE";
    public static final String ACTION_STOP = "dcl.audiobook.STOP";
    public static final String ACTION_NEXT = "dcl.audiobook.NEXT";
    public static final String ACTION_PREV = "dcl.audiobook.PREV";
    public static final String ACTION_SEEK_PAGE = "dcl.audiobook.SEEK_PAGE";

    private static final String CHANNEL_ID = "audiobook";
    private static final int NOTIFICATION_ID = 0x0B00C;
    /** Android's speech engine rejects very long strings; well under the limit is safest. */
    private static final int TTS_CHUNK = 1500;

    /** Delivers progress back to the web layer while it is alive; null when it is not. */
    public interface Listener {
        void onPage(int page);
        void onState(boolean playing);
        void onFinished();
        void onError(String message);
    }

    private static Listener listener;
    private static boolean running;

    public static void setListener(@Nullable Listener l) {
        listener = l;
    }

    public static boolean isRunning() {
        return running;
    }

    public static class Page {
        final int page;
        final String text;
        final String url;

        Page(int page, String text, String url) {
            this.page = page;
            this.text = text;
            this.url = url;
        }
    }

    private final List<Page> pages = new ArrayList<>();
    private int index = 0;
    private String mode = "tts";
    private String title = "";
    private String author = "";
    private float rate = 1.0f;
    private boolean playing = false;

    private TextToSpeech tts;
    private boolean ttsReady = false;
    private MediaPlayer player;
    private MediaSessionCompat session;
    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;

    /** Chunks of the page being spoken; the last utterance id tells us the page is done. */
    private int pendingChunks = 0;

    private final BroadcastReceiver noisyReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            // Headphones pulled out — stop talking into the room.
            pause();
        }
    };

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        running = true;
        audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        createChannel();
        setupSession();
        registerReceiver(noisyReceiver, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null || intent.getAction() == null) {
            MediaButtonReceiver.handleIntent(session, intent);
            return START_NOT_STICKY;
        }
        switch (intent.getAction()) {
            case ACTION_START:
                startBook(intent);
                break;
            case ACTION_PLAY:
                play();
                break;
            case ACTION_PAUSE:
                pause();
                break;
            case ACTION_NEXT:
                skip(1);
                break;
            case ACTION_PREV:
                skip(-1);
                break;
            case ACTION_SEEK_PAGE:
                seekToPage(intent.getIntExtra("page", 1));
                break;
            case ACTION_STOP:
                stopEverything();
                break;
            default:
                MediaButtonReceiver.handleIntent(session, intent);
        }
        return START_NOT_STICKY;
    }

    /* ------------------------------------------------------------------ */

    private void startBook(Intent intent) {
        pages.clear();
        mode = intent.getStringExtra("mode") == null ? "tts" : intent.getStringExtra("mode");
        title = intent.getStringExtra("title") == null ? "" : intent.getStringExtra("title");
        author = intent.getStringExtra("author") == null ? "" : intent.getStringExtra("author");
        rate = intent.getFloatExtra("rate", 1.0f);

        int[] numbers = intent.getIntArrayExtra("pageNumbers");
        String[] texts = intent.getStringArrayExtra("texts");
        String[] urls = intent.getStringArrayExtra("urls");
        if (numbers != null) {
            for (int i = 0; i < numbers.length; i++) {
                pages.add(new Page(
                        numbers[i],
                        texts != null && i < texts.length ? texts[i] : "",
                        urls != null && i < urls.length ? urls[i] : null));
            }
        }
        int startPage = intent.getIntExtra("startPage", 0);
        index = 0;
        for (int i = 0; i < pages.size(); i++) {
            if (pages.get(i).page == startPage) {
                index = i;
                break;
            }
        }
        startForegroundSafely();
        if ("tts".equals(mode)) initTts();
        else play();
    }

    private void initTts() {
        if (tts != null) {
            play();
            return;
        }
        tts = new TextToSpeech(this, status -> {
            if (status != TextToSpeech.SUCCESS) {
                fail("تعذر تشغيل محرّك النطق على هذا الجهاز");
                return;
            }
            int result = tts.setLanguage(new Locale("ar"));
            if (result == TextToSpeech.LANG_MISSING_DATA || result == TextToSpeech.LANG_NOT_SUPPORTED) {
                fail("لا يوجد صوت عربي مثبّت على الجهاز");
                return;
            }
            tts.setSpeechRate(rate);
            tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
                @Override
                public void onStart(String utteranceId) {
                }

                @Override
                public void onDone(String utteranceId) {
                    pendingChunks--;
                    if (pendingChunks <= 0 && playing) advanceAfterPage();
                }

                @Override
                public void onError(String utteranceId) {
                    fail("توقّف النطق");
                }
            });
            ttsReady = true;
            play();
        });
    }

    private void play() {
        if (pages.isEmpty()) return;
        if (!requestFocus()) return;
        playing = true;
        startForegroundSafely();
        if ("tts".equals(mode)) {
            if (!ttsReady) {
                initTts();
                return;
            }
            speakCurrentPage();
        } else {
            playCurrentUrl();
        }
        notifyState();
    }

    private void speakCurrentPage() {
        if (tts == null || index < 0 || index >= pages.size()) return;
        tts.stop();
        String text = pages.get(index).text;
        if (text == null || text.trim().isEmpty()) {
            advanceAfterPage();
            return;
        }
        List<String> chunks = split(text);
        pendingChunks = chunks.size();
        HashMap<String, String> params = new HashMap<>();
        for (int i = 0; i < chunks.size(); i++) {
            String id = "p" + pages.get(index).page + "_" + i;
            params.put(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, id);
            int queue = i == 0 ? TextToSpeech.QUEUE_FLUSH : TextToSpeech.QUEUE_ADD;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                tts.speak(chunks.get(i), queue, null, id);
            } else {
                tts.speak(chunks.get(i), queue, params);
            }
        }
        emitPage();
        updateNotification();
    }

    private void playCurrentUrl() {
        if (index < 0 || index >= pages.size()) return;
        String url = pages.get(index).url;
        if (url == null || url.isEmpty()) {
            advanceAfterPage();
            return;
        }
        releasePlayer();
        player = new MediaPlayer();
        try {
            player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build());
            player.setDataSource(url);
            player.setOnPreparedListener(mp -> {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    mp.setPlaybackParams(mp.getPlaybackParams().setSpeed(rate));
                }
                mp.start();
                emitPage();
                updateNotification();
            });
            player.setOnCompletionListener(mp -> advanceAfterPage());
            player.setOnErrorListener((mp, what, extra) -> {
                fail("تعذر تشغيل صوت الصفحة");
                return true;
            });
            player.prepareAsync();
        } catch (Exception e) {
            fail("تعذر تشغيل صوت الصفحة");
        }
    }

    private void advanceAfterPage() {
        if (index + 1 >= pages.size()) {
            playing = false;
            notifyState();
            if (listener != null) listener.onFinished();
            updateNotification();
            stopEverything();
            return;
        }
        index++;
        if ("tts".equals(mode)) speakCurrentPage();
        else playCurrentUrl();
    }

    private void skip(int delta) {
        int next = index + delta;
        if (next < 0 || next >= pages.size()) return;
        index = next;
        if (playing) {
            if ("tts".equals(mode)) speakCurrentPage();
            else playCurrentUrl();
        } else {
            emitPage();
            updateNotification();
        }
    }

    private void seekToPage(int page) {
        for (int i = 0; i < pages.size(); i++) {
            if (pages.get(i).page == page) {
                index = i;
                if (playing) {
                    if ("tts".equals(mode)) speakCurrentPage();
                    else playCurrentUrl();
                } else {
                    emitPage();
                    updateNotification();
                }
                return;
            }
        }
    }

    private void pause() {
        playing = false;
        if (tts != null) tts.stop();
        if (player != null && player.isPlaying()) player.pause();
        pendingChunks = 0;
        notifyState();
        updateNotification();
    }

    private void stopEverything() {
        playing = false;
        abandonFocus();
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
            ttsReady = false;
        }
        releasePlayer();
        notifyState();
        stopForegroundCompat();
        stopSelf();
    }

    private void releasePlayer() {
        if (player != null) {
            try {
                player.reset();
                player.release();
            } catch (Exception ignored) {
            }
            player = null;
        }
    }

    private void fail(String message) {
        playing = false;
        if (listener != null) listener.onError(message);
        notifyState();
        updateNotification();
    }

    private void emitPage() {
        if (listener != null && index >= 0 && index < pages.size()) listener.onPage(pages.get(index).page);
    }

    private void notifyState() {
        if (listener != null) listener.onState(playing);
        if (session != null) {
            session.setPlaybackState(new PlaybackStateCompat.Builder()
                    .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE
                            | PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                            | PlaybackStateCompat.ACTION_STOP)
                    .setState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
                            PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN, rate)
                    .build());
        }
    }

    private static List<String> split(String text) {
        List<String> out = new ArrayList<>();
        String remaining = text.trim();
        while (remaining.length() > TTS_CHUNK) {
            int cut = remaining.lastIndexOf('\n', TTS_CHUNK);
            if (cut < TTS_CHUNK / 2) cut = remaining.lastIndexOf(' ', TTS_CHUNK);
            if (cut < TTS_CHUNK / 2) cut = TTS_CHUNK;
            out.add(remaining.substring(0, cut).trim());
            remaining = remaining.substring(cut).trim();
        }
        if (!remaining.isEmpty()) out.add(remaining);
        return out;
    }

    /* ---------------------- audio focus ---------------------- */

    private final AudioManager.OnAudioFocusChangeListener focusListener = change -> {
        if (change == AudioManager.AUDIOFOCUS_LOSS || change == AudioManager.AUDIOFOCUS_LOSS_TRANSIENT) pause();
    };

    private boolean requestFocus() {
        if (audioManager == null) return true;
        int result;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                    .setAudioAttributes(new AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                            .build())
                    .setOnAudioFocusChangeListener(focusListener)
                    .build();
            result = audioManager.requestAudioFocus(focusRequest);
        } else {
            result = audioManager.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
        }
        return result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
    }

    private void abandonFocus() {
        if (audioManager == null) return;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            if (focusRequest != null) audioManager.abandonAudioFocusRequest(focusRequest);
        } else {
            audioManager.abandonAudioFocus(focusListener);
        }
    }

    /* ---------------------- notification ---------------------- */

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null || manager.getNotificationChannel(CHANNEL_ID) != null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID, "الكتاب الصوتي", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("التحكم في قراءة الكتاب بصوت مسموع");
        channel.setShowBadge(false);
        manager.createNotificationChannel(channel);
    }

    private void setupSession() {
        session = new MediaSessionCompat(this, "dcl-audiobook");
        session.setCallback(new MediaSessionCompat.Callback() {
            @Override
            public void onPlay() {
                play();
            }

            @Override
            public void onPause() {
                pause();
            }

            @Override
            public void onSkipToNext() {
                skip(1);
            }

            @Override
            public void onSkipToPrevious() {
                skip(-1);
            }

            @Override
            public void onStop() {
                stopEverything();
            }
        });
        session.setActive(true);
    }

    private PendingIntent actionIntent(String action) {
        Intent intent = new Intent(this, AudiobookService.class).setAction(action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getService(this, action.hashCode(), intent, flags);
    }

    private Notification buildNotification() {
        String pageLabel = pages.isEmpty() || index >= pages.size()
                ? ""
                : "صفحة " + pages.get(index).page + " من " + pages.get(pages.size() - 1).page;

        Intent open = new Intent(this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_media_play)
                .setContentTitle(title.isEmpty() ? "الكتاب الصوتي" : title)
                .setContentText(pageLabel.isEmpty() ? author : pageLabel)
                .setContentIntent(PendingIntent.getActivity(this, 0, open, flags))
                .setDeleteIntent(actionIntent(ACTION_STOP))
                .setOnlyAlertOnce(true)
                .setShowWhen(false)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .addAction(android.R.drawable.ic_media_previous, "السابق", actionIntent(ACTION_PREV))
                .addAction(playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play,
                        playing ? "إيقاف" : "تشغيل", actionIntent(playing ? ACTION_PAUSE : ACTION_PLAY))
                .addAction(android.R.drawable.ic_media_next, "التالي", actionIntent(ACTION_NEXT))
                .setStyle(new MediaStyle()
                        .setMediaSession(session.getSessionToken())
                        .setShowActionsInCompactView(0, 1, 2)
                        .setShowCancelButton(true)
                        .setCancelButtonIntent(actionIntent(ACTION_STOP)));

        if (session != null) {
            session.setMetadata(new MediaMetadataCompat.Builder()
                    .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
                    .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, author)
                    .build());
        }
        return builder.build();
    }

    private void startForegroundSafely() {
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
    }

    private void updateNotification() {
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null && running) manager.notify(NOTIFICATION_ID, buildNotification());
    }

    private void stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) stopForeground(Service.STOP_FOREGROUND_REMOVE);
        else stopForeground(true);
    }

    @Override
    public void onDestroy() {
        running = false;
        try {
            unregisterReceiver(noisyReceiver);
        } catch (Exception ignored) {
        }
        abandonFocus();
        if (tts != null) {
            tts.shutdown();
            tts = null;
        }
        releasePlayer();
        if (session != null) {
            session.setActive(false);
            session.release();
            session = null;
        }
        super.onDestroy();
    }

    /** Unused but kept for clarity: the service never restores state from a Bundle. */
    @SuppressWarnings("unused")
    private Bundle emptyExtras() {
        return new Bundle();
    }
}
