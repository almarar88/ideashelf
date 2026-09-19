package com.digitalcodelibrary.app;

import android.os.Bundle;
import android.view.WindowManager;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /**
     * Store books are sold, not given away. FLAG_SECURE makes Android refuse screenshots
     * and screen recording for this window, and keeps the app out of the recents preview.
     * It is a deterrent, not a guarantee — a camera pointed at the screen still works —
     * but it removes the easy one-tap way to copy a paid page.
     */
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE);
    }
}
