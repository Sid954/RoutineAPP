package com.routine.app;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.MessageDigest;

/**
 * In-app updater: downloads a release APK into the app cache (with progress events and
 * SHA-256 verification) and hands it to the system package installer via FileProvider.
 * Android only installs it if it is signed with the same key as the installed app.
 *
 * JS: Capacitor.Plugins.AppUpdater
 *   canInstall()            -> { allowed }
 *   openInstallSettings()   -> opens "Install unknown apps" for this app
 *   download({url, versionCode, sha256?, size?}) -> { path, size, sha256, cached }
 *     events: "downloadProgress" { received, total, percent }
 *   cancelDownload()
 *   install({path})         -> { started } or { needsPermission: true }
 *   clearDownloads()
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    private static final String DIR = "updates";
    private volatile boolean cancelled = false;
    private volatile Thread worker = null;

    private File updatesDir() {
        File dir = new File(getContext().getCacheDir(), DIR);
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    private boolean installAllowed() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        return getContext().getPackageManager().canRequestPackageInstalls();
    }

    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("allowed", installAllowed());
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getContext().getPackageName()));
            } else {
                intent = new Intent(Settings.ACTION_SECURITY_SETTINGS);
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Could not open settings: " + e.getMessage());
        }
    }

    private static String sha256File(File f) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        try (InputStream in = new FileInputStream(f)) {
            byte[] buf = new byte[64 * 1024];
            int n;
            while ((n = in.read(buf)) > 0) md.update(buf, 0, n);
        }
        return hex(md.digest());
    }

    private static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }

    @PluginMethod
    public void download(final PluginCall call) {
        final String url = call.getString("url");
        Object rawCode = call.getData().opt("versionCode");
        final int versionCode = rawCode instanceof Number ? ((Number) rawCode).intValue() : 0;
        final String expectedSha = call.getString("sha256", "").toLowerCase();
        // JSON numbers arrive as Integer or Long (or Double): PluginCall.getLong() only accepts Long
        Object rawSize = call.getData().opt("size");
        final long expectedSize = rawSize instanceof Number ? ((Number) rawSize).longValue() : 0L;
        if (url == null || !(url.startsWith("https://"))) {
            call.reject("A https download URL is required.");
            return;
        }
        if (worker != null && worker.isAlive()) {
            call.reject("A download is already running.");
            return;
        }

        final File target = new File(updatesDir(), "routine-" + versionCode + ".apk");

        // Already downloaded and intact: reuse it
        try {
            if (target.exists() && target.length() > 0) {
                String have = sha256File(target);
                boolean ok = expectedSha.isEmpty()
                        ? (expectedSize <= 0 || target.length() == expectedSize)
                        : have.equals(expectedSha);
                if (ok) {
                    JSObject ret = new JSObject();
                    ret.put("path", target.getAbsolutePath());
                    ret.put("size", target.length());
                    ret.put("sha256", have);
                    ret.put("cached", true);
                    call.resolve(ret);
                    return;
                }
                target.delete();
            }
        } catch (Exception ignored) {
            target.delete();
        }

        cancelled = false;
        worker = new Thread(() -> {
            File tmp = new File(updatesDir(), "routine-" + versionCode + ".part");
            HttpURLConnection conn = null;
            try {
                // Follow redirects ourselves (the API redirects to GitHub's signed CDN URL)
                URL current = new URL(url);
                int hops = 0;
                while (true) {
                    conn = (HttpURLConnection) current.openConnection();
                    conn.setInstanceFollowRedirects(false);
                    conn.setConnectTimeout(15000);
                    conn.setReadTimeout(30000);
                    conn.setRequestProperty("User-Agent", "RoutineApp-Updater");
                    int code = conn.getResponseCode();
                    if (code >= 300 && code < 400) {
                        String loc = conn.getHeaderField("Location");
                        conn.disconnect();
                        if (loc == null || ++hops > 5) throw new Exception("Too many redirects");
                        current = new URL(current, loc);
                        if (!"https".equals(current.getProtocol())) throw new Exception("Refusing a non-https redirect");
                        continue;
                    }
                    if (code != 200) throw new Exception("Server answered " + code);
                    break;
                }

                long total = conn.getContentLengthLong();
                if (total <= 0) total = expectedSize;
                MessageDigest md = MessageDigest.getInstance("SHA-256");
                long received = 0;
                long lastEmit = 0;
                try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(tmp)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        if (cancelled) throw new InterruptedException("cancelled");
                        out.write(buf, 0, n);
                        md.update(buf, 0, n);
                        received += n;
                        long now = System.currentTimeMillis();
                        if (now - lastEmit > 150) {
                            lastEmit = now;
                            emitProgress(received, total);
                        }
                    }
                }
                emitProgress(received, total);

                String got = hex(md.digest());
                if (!expectedSha.isEmpty() && !got.equals(expectedSha)) {
                    tmp.delete();
                    throw new Exception("The download was corrupted (checksum mismatch). Try again.");
                }
                if (target.exists()) target.delete();
                if (!tmp.renameTo(target)) throw new Exception("Could not save the update file.");

                // Keep only this version's APK
                File[] files = updatesDir().listFiles();
                if (files != null) {
                    for (File f : files) if (!f.getName().equals(target.getName())) f.delete();
                }

                JSObject ret = new JSObject();
                ret.put("path", target.getAbsolutePath());
                ret.put("size", target.length());
                ret.put("sha256", got);
                ret.put("cached", false);
                call.resolve(ret);
            } catch (InterruptedException e) {
                tmp.delete();
                call.reject("cancelled", "CANCELLED");
            } catch (Exception e) {
                tmp.delete();
                call.reject(e.getMessage() != null ? e.getMessage() : "Download failed", "DOWNLOAD_FAILED");
            } finally {
                if (conn != null) conn.disconnect();
                worker = null;
            }
        }, "AppUpdaterDownload");
        worker.start();
    }

    private void emitProgress(long received, long total) {
        JSObject data = new JSObject();
        data.put("received", received);
        data.put("total", total);
        data.put("percent", total > 0 ? Math.min(100, (int) (received * 100 / total)) : -1);
        notifyListeners("downloadProgress", data);
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        cancelled = true;
        call.resolve();
    }

    @PluginMethod
    public void install(PluginCall call) {
        String path = call.getString("path");
        if (path == null) {
            call.reject("No file to install.");
            return;
        }
        File file = new File(path);
        // Only files we downloaded ourselves
        if (!file.exists() || !file.getParentFile().equals(updatesDir())) {
            call.reject("The update file is missing. Download it again.");
            return;
        }
        if (!installAllowed()) {
            JSObject ret = new JSObject();
            ret.put("needsPermission", true);
            call.resolve(ret);
            return;
        }
        try {
            Context ctx = getContext();
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", file);
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(uri, "application/vnd.android.package-archive");
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            JSObject ret = new JSObject();
            ret.put("started", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Could not open the installer: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearDownloads(PluginCall call) {
        File[] files = updatesDir().listFiles();
        if (files != null) for (File f : files) f.delete();
        call.resolve();
    }
}
