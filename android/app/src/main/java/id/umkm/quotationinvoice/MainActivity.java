package id.umkm.quotationinvoice;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ObjectAnimator;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.animation.DecelerateInterpolator;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        // Smooth crossfade from Android 12+ native splash into WebView LaunchSplash (zero harsh cut)
        splashScreen.setOnExitAnimationListener((splashScreenView) -> {
            View root = splashScreenView.getView();
            ObjectAnimator fadeOut = ObjectAnimator.ofFloat(root, View.ALPHA, 1f, 0f);
            fadeOut.setDuration(220L);
            fadeOut.setInterpolator(new DecelerateInterpolator());
            fadeOut.addListener(new AnimatorListenerAdapter() {
                @Override
                public void onAnimationEnd(Animator animation) {
                    splashScreenView.remove();
                }
            });
            fadeOut.start();
        });
        super.onCreate(savedInstanceState);

        // Single-source edge-to-edge inset handling (eliminates double top gap on Redmi 13C & Android 13-16)
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        View decorView = getWindow().getDecorView();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), decorView);
        if (controller != null) {
            int nightModeFlags = getResources().getConfiguration().uiMode
                & android.content.res.Configuration.UI_MODE_NIGHT_MASK;
            boolean isDark = nightModeFlags == android.content.res.Configuration.UI_MODE_NIGHT_YES;
            controller.setAppearanceLightStatusBars(!isDark);
            controller.setAppearanceLightNavigationBars(!isDark);
        }

        // Single-source insets listener on decorView (SystemBars.insetsHandling is 'disable' in capacitor.config.ts).
        // Attaching on decorView avoids racing with @capacitor/keyboard's listener on android.R.id.content,
        // and zeroing systemBars + displayCutout + ime in the returned insets prevents double padding or
        // double keyboard resize (white void above IME) on Android 13-16 & Chromium WebView >= 139.
        ViewCompat.setOnApplyWindowInsetsListener(decorView, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            boolean imeVisible = windowInsets.isVisible(WindowInsetsCompat.Type.ime());
            int bottomPadding = imeVisible ? Math.max(bars.bottom, ime.bottom) : bars.bottom;

            v.setPadding(bars.left, bars.top, bars.right, bottomPadding);

            return new WindowInsetsCompat.Builder(windowInsets)
                .setInsets(
                    WindowInsetsCompat.Type.systemBars()
                        | WindowInsetsCompat.Type.displayCutout()
                        | WindowInsetsCompat.Type.ime(),
                    Insets.NONE
                )
                .setVisible(WindowInsetsCompat.Type.ime(), false)
                .build();
        });
        ViewCompat.requestApplyInsets(decorView);
    }
}
