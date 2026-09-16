package com.ideashelf.partnerhub;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PartnerHubPlugin.class);
        super.onCreate(savedInstanceState);
        ReminderWorker.ensureScheduled(this);
    }
}
