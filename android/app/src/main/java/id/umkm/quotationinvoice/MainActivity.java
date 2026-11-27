package id.umkm.quotationinvoice;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ObjectAnimator;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.animation.DecelerateInterpolator;
import androidx.annotation.NonNull;
import androidx.core.graphics.Insets;
import androidx.core.splashscreen.SplashScreen;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsAnimationCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import java.util.List;

public class MainActivity extends BridgeActivity {
    private boolean imeAnimating = false;

    private static WindowInsetsCompat consumeSystemAndImeInsets(WindowInsetsCompat windowInsets) {
        return new WindowInsetsCompat.Builder(windowInsets)
            .setInsets(
                WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout()
                    | WindowInsetsCompat.Type.ime(),
                Insets.NONE
            )
            .setVisible(WindowInsetsCompat.Type.ime(), false)
            .build();
    }
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

        // Single-source insets listener + frame-by-frame IME animation callback on decorView
        // (SystemBars.insetsHandling is 'disable' in capacitor.config.ts).
        // Tracks keyboard open/close smoothly at 60/90Hz on Android 11-16 while zeroing returned
        // insets so Chromium WebView never adds double keyboard padding (white void above IME).
        ViewCompat.setOnApplyWindowInsetsListener(decorView, (v, windowInsets) -> {
            Insets bars = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
            );
            Insets ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime());
            boolean imeVisible = windowInsets.isVisible(WindowInsetsCompat.Type.ime());

            if (!imeAnimating) {
                int bottomPadding = imeVisible ? Math.max(bars.bottom, ime.bottom) : bars.bottom;
                v.setPadding(bars.left, bars.top, bars.right, bottomPadding);
            }

            return consumeSystemAndImeInsets(windowInsets);
        });

        ViewCompat.setWindowInsetsAnimationCallback(
            decorView,
            new WindowInsetsAnimationCompat.Callback(WindowInsetsAnimationCompat.Callback.DISPATCH_MODE_STOP) {
                @Override
                public void onPrepare(@NonNull WindowInsetsAnimationCompat animation) {
                    if ((animation.getTypeMask() & WindowInsetsCompat.Type.ime()) != 0) {
                        imeAnimating = true;
                    }
                }

                @NonNull
                @Override
                public WindowInsetsCompat onProgress(
                    @NonNull WindowInsetsCompat insets,
                    @NonNull List<WindowInsetsAnimationCompat> runningAnimations
                ) {
                    Insets bars = insets.getInsets(
                        WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout()
                    );
                    Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
                    decorView.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
                    return consumeSystemAndImeInsets(insets);
                }

                @Override
                public void onEnd(@NonNull WindowInsetsAnimationCompat animation) {
                    if ((animation.getTypeMask() & WindowInsetsCompat.Type.ime()) != 0) {
                        imeAnimating = false;
                        ViewCompat.requestApplyInsets(decorView);
                    }
                }
            }
        );
        ViewCompat.requestApplyInsets(decorView);
    }
}
