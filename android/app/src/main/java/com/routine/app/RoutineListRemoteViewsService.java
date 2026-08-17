package com.routine.app;

import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViewsService;

public class RoutineListRemoteViewsService extends RemoteViewsService {
    @Override
    public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new RoutineListRemoteViewsFactory(this.getApplicationContext());
    }
}
