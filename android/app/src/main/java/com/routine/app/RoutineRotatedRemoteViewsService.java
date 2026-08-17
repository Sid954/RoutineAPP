package com.routine.app;

import android.content.Intent;
import android.widget.RemoteViewsService;

public class RoutineRotatedRemoteViewsService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new RoutineRotatedRemoteViewsFactory(this.getApplicationContext());
    }
}
