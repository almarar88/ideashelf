package com.digitalcodelibrary.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.List;

/**
 * Bridge between the reader UI and {@link AudiobookService}.
 *
 * The web layer hands over the whole run of pages at once — text for the device voice,
 * or pre-signed audio URLs for store books — because once the app is backgrounded it can
 * no longer be asked for the next one.
 */
@CapacitorPlugin(name = "Audiobook")
public class AudiobookPlugin extends Plugin {

    @Override
    public void load() {
        AudiobookService.setListener(new AudiobookService.Listener() {
            @Override
            public void onPage(int page) {
                JSObject data = new JSObject();
                data.put("page", page);
                notifyListeners("pageChanged", data);
            }

            @Override
            public void onState(boolean playing) {
                JSObject data = new JSObject();
                data.put("playing", playing);
                notifyListeners("stateChanged", data);
            }

            @Override
            public void onFinished() {
                notifyListeners("finished", new JSObject());
            }

            @Override
            public void onError(String message) {
                JSObject data = new JSObject();
                data.put("message", message);
                notifyListeners("narrationError", data);
            }
        });
    }

    @Override
    protected void handleOnDestroy() {
        AudiobookService.setListener(null);
        super.handleOnDestroy();
    }

    /** Android 13+ hides the media notification without this, which also kills the controls. */
    @PluginMethod
    public void ensureNotificationPermission(PluginCall call) {
        JSObject result = new JSObject();
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
            result.put("granted", true);
            call.resolve(result);
            return;
        }
        boolean granted = getContext().checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
        if (!granted && getActivity() != null) {
            getActivity().requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 5501);
        }
        result.put("granted", granted);
        call.resolve(result);
    }

    @PluginMethod
    public void start(PluginCall call) {
        JSArray pagesArray = call.getArray("pages");
        if (pagesArray == null) {
            call.reject("pages is required");
            return;
        }
        int count;
        List<JSONObject> list;
        try {
            list = pagesArray.toList();
            count = list.size();
        } catch (org.json.JSONException e) {
            call.reject("pages is malformed");
            return;
        }
        int[] numbers = new int[count];
        String[] texts = new String[count];
        String[] urls = new String[count];
        for (int i = 0; i < count; i++) {
            JSONObject item = list.get(i);
            numbers[i] = item.optInt("page", i + 1);
            texts[i] = item.optString("text", "");
            urls[i] = item.optString("url", "");
        }

        Intent intent = new Intent(getContext(), AudiobookService.class)
                .setAction(AudiobookService.ACTION_START)
                .putExtra("mode", call.getString("mode", "tts"))
                .putExtra("title", call.getString("title", ""))
                .putExtra("author", call.getString("author", ""))
                .putExtra("rate", call.getFloat("rate", 1.0f))
                .putExtra("startPage", call.getInt("startPage", numbers.length > 0 ? numbers[0] : 1))
                .putExtra("pageNumbers", numbers)
                .putExtra("texts", texts)
                .putExtra("urls", urls);
        startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void play(PluginCall call) {
        send(AudiobookService.ACTION_PLAY);
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        send(AudiobookService.ACTION_PAUSE);
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        send(AudiobookService.ACTION_STOP);
        call.resolve();
    }

    @PluginMethod
    public void next(PluginCall call) {
        send(AudiobookService.ACTION_NEXT);
        call.resolve();
    }

    @PluginMethod
    public void previous(PluginCall call) {
        send(AudiobookService.ACTION_PREV);
        call.resolve();
    }

    @PluginMethod
    public void seekToPage(PluginCall call) {
        Intent intent = new Intent(getContext(), AudiobookService.class)
                .setAction(AudiobookService.ACTION_SEEK_PAGE)
                .putExtra("page", call.getInt("page", 1));
        startService(intent);
        call.resolve();
    }

    @PluginMethod
    public void isRunning(PluginCall call) {
        JSObject result = new JSObject();
        result.put("running", AudiobookService.isRunning());
        call.resolve(result);
    }

    private void send(String action) {
        startService(new Intent(getContext(), AudiobookService.class).setAction(action));
    }

    private void startService(Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) getContext().startForegroundService(intent);
        else getContext().startService(intent);
    }

    /** Kept for readability of the JSON plumbing above. */
    @SuppressWarnings("unused")
    private static JSONArray unusedHelper() {
        return new JSONArray();
    }
}
