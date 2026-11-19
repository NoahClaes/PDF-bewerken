package be.pdfbewerken.plugin;

import android.content.ActivityNotFoundException;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;

import androidx.core.content.FileProvider;

import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.PluginResult;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Brug tussen de editor en Android:
 *  save     PDF opslaan in de map Download (zichtbaar in Bestanden)
 *  share    een opgeslagen PDF delen (WhatsApp, mail, Drive...)
 *  open     een opgeslagen PDF openen in een PDF-lezer
 *  onFile   PDF's die met "Openen met" of "Delen" naar deze app gestuurd worden
 *  version  versienummer van de app
 *  update   nieuwe versie downloaden en het Android-installatievenster tonen
 *  exit     de app sluiten (terugknop)
 */
public class PdfbAndroid extends CordovaPlugin {
    private CallbackContext fileCb;

    private Context ctx() { return cordova.getActivity().getApplicationContext(); }
    private String authority() { return ctx().getPackageName() + ".pdfb.provider"; }

    @Override
    public boolean execute(String action, JSONArray args, final CallbackContext cb) throws JSONException {
        switch (action) {
            case "save": {
                final String name = args.getString(0), b64 = args.getString(1), sub = args.optString(2, "");
                cordova.getThreadPool().execute(() -> {
                    try { cb.success(save(name, Base64.decode(b64, Base64.DEFAULT), sub)); }
                    catch (Exception e) { cb.error(msg(e)); }
                });
                return true;
            }
            case "share": {
                Intent i = new Intent(Intent.ACTION_SEND);
                i.setType("application/pdf");
                i.putExtra(Intent.EXTRA_STREAM, Uri.parse(args.getString(0)));
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { cordova.getActivity().startActivity(Intent.createChooser(i, "PDF delen")); cb.success(); }
                catch (Exception e) { cb.error(msg(e)); }
                return true;
            }
            case "open": {
                Intent i = new Intent(Intent.ACTION_VIEW);
                i.setDataAndType(Uri.parse(args.getString(0)), "application/pdf");
                i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try { cordova.getActivity().startActivity(i); cb.success(); }
                catch (ActivityNotFoundException e) { cb.error("Geen app gevonden om PDF's te openen."); }
                return true;
            }
            case "onFile": {
                fileCb = cb;
                PluginResult r = new PluginResult(PluginResult.Status.NO_RESULT);
                r.setKeepCallback(true);
                cb.sendPluginResult(r);
                handleIntent(cordova.getActivity().getIntent());
                return true;
            }
            case "version": {
                try { cb.success(ctx().getPackageManager().getPackageInfo(ctx().getPackageName(), 0).versionName); }
                catch (Exception e) { cb.error(msg(e)); }
                return true;
            }
            case "update": {
                final String url = args.getString(0);
                cordova.getThreadPool().execute(() -> download(url, cb));
                return true;
            }
            case "exit": {
                cordova.getActivity().moveTaskToBack(true);
                cb.success();
                return true;
            }
        }
        return false;
    }

    private static String msg(Exception e) { return e.getMessage() != null ? e.getMessage() : e.toString(); }

    private JSONObject save(String name, byte[] data, String sub) throws Exception {
        ContentResolver cr = ctx().getContentResolver();
        Uri uri;
        String shown;
        if (Build.VERSION.SDK_INT >= 29) {
            String rel = Environment.DIRECTORY_DOWNLOADS + (sub.isEmpty() ? "" : "/" + sub);
            ContentValues v = new ContentValues();
            v.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
            v.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");
            v.put(MediaStore.MediaColumns.RELATIVE_PATH, rel);
            v.put(MediaStore.MediaColumns.IS_PENDING, 1);
            uri = cr.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
            if (uri == null) throw new IOException("Kon geen bestand maken in Download.");
            try (OutputStream o = cr.openOutputStream(uri)) {
                if (o == null) throw new IOException("Kon het bestand niet schrijven.");
                o.write(data);
            }
            v.clear();
            v.put(MediaStore.MediaColumns.IS_PENDING, 0);
            cr.update(uri, v, null, null);
            String real = name;
            try (Cursor c = cr.query(uri, new String[]{MediaStore.MediaColumns.DISPLAY_NAME}, null, null, null)) {
                if (c != null && c.moveToFirst() && c.getString(0) != null) real = c.getString(0);
            } catch (Exception ignored) { }
            shown = rel + "/" + real;
        } else {
            File base = ctx().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            File dir = sub.isEmpty() ? base : new File(base, sub);
            if (dir != null && !dir.exists()) dir.mkdirs();
            File f = new File(dir, name);
            try (FileOutputStream o = new FileOutputStream(f)) { o.write(data); }
            uri = FileProvider.getUriForFile(ctx(), authority(), f);
            shown = f.getAbsolutePath();
        }
        JSONObject r = new JSONObject();
        r.put("uri", uri.toString());
        r.put("path", shown);
        return r;
    }

    @Override
    public void onNewIntent(Intent intent) {
        cordova.getActivity().setIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent in) {
        if (in == null || fileCb == null) return;
        String a = in.getAction();
        Uri u = null;
        if (Intent.ACTION_VIEW.equals(a)) u = in.getData();
        else if (Intent.ACTION_SEND.equals(a)) u = (Uri) in.getParcelableExtra(Intent.EXTRA_STREAM);
        if (u == null) return;
        final Uri uri = u;
        // niet nog eens openen bij het opnieuw starten van de pagina
        in.setAction(Intent.ACTION_MAIN);
        in.setData(null);
        in.removeExtra(Intent.EXTRA_STREAM);
        cordova.getThreadPool().execute(() -> {
            try {
                ContentResolver cr = ctx().getContentResolver();
                String name = null;
                try (Cursor c = cr.query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                    if (c != null && c.moveToFirst()) name = c.getString(0);
                } catch (Exception ignored) { }
                if (name == null) name = uri.getLastPathSegment();
                if (name == null || name.isEmpty()) name = "document.pdf";
                if (name.contains("/")) name = name.substring(name.lastIndexOf('/') + 1);
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                try (InputStream is = cr.openInputStream(uri)) {
                    if (is == null) throw new IOException("Kon het bestand niet lezen.");
                    byte[] buf = new byte[65536];
                    int n;
                    while ((n = is.read(buf)) > 0) bo.write(buf, 0, n);
                }
                JSONObject o = new JSONObject();
                o.put("name", name);
                o.put("b64", Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP));
                PluginResult r = new PluginResult(PluginResult.Status.OK, o);
                r.setKeepCallback(true);
                fileCb.sendPluginResult(r);
            } catch (Exception e) {
                try {
                    JSONObject o = new JSONObject();
                    o.put("error", msg(e));
                    PluginResult r = new PluginResult(PluginResult.Status.OK, o);
                    r.setKeepCallback(true);
                    fileCb.sendPluginResult(r);
                } catch (JSONException ignored) { }
            }
        });
    }

    private void download(String url, CallbackContext cb) {
        HttpURLConnection c = null;
        try {
            File dir = new File(ctx().getCacheDir(), "updates");
            if (!dir.exists()) dir.mkdirs();
            File f = new File(dir, "PDF-Bewerken.apk");
            URL u = new URL(url);
            for (int hops = 0; ; hops++) {
                c = (HttpURLConnection) u.openConnection();
                c.setInstanceFollowRedirects(false);
                c.setRequestProperty("User-Agent", "PDF-Bewerken-Android");
                c.setConnectTimeout(20000);
                c.setReadTimeout(60000);
                int code = c.getResponseCode();
                if (code >= 300 && code < 400) {
                    String loc = c.getHeaderField("Location");
                    c.disconnect();
                    if (loc == null || hops > 6) throw new IOException("Te veel doorverwijzingen.");
                    u = new URL(u, loc);
                    continue;
                }
                if (code != 200) throw new IOException("Download mislukt (HTTP " + code + ").");
                break;
            }
            long total = c.getContentLengthLong(), got = 0;
            int last = -1;
            try (InputStream is = c.getInputStream(); FileOutputStream o = new FileOutputStream(f)) {
                byte[] buf = new byte[65536];
                int n;
                while ((n = is.read(buf)) > 0) {
                    o.write(buf, 0, n);
                    got += n;
                    int p = total > 0 ? (int) Math.min(99, got * 100 / total) : 0;
                    if (p != last) {
                        last = p;
                        PluginResult r = new PluginResult(PluginResult.Status.OK, p);
                        r.setKeepCallback(true);
                        cb.sendPluginResult(r);
                    }
                }
            }
            Uri au = FileProvider.getUriForFile(ctx(), authority(), f);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(au, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            cordova.getActivity().startActivity(i);
            cb.sendPluginResult(new PluginResult(PluginResult.Status.OK, 100));
        } catch (Exception e) {
            cb.error(msg(e));
        } finally {
            if (c != null) c.disconnect();
        }
    }
}
