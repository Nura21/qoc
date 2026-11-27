import { type Animation, createAnimation } from '@ionic/react';

/**
 * QOC Smooth Motion System — GPU-Composited 60fps Curves
 *
 * Replaces Ionic's default MD ease-in close curves (`cubic-bezier(0.47, 0, 0.745, 0.715)`)
 * and sluggish 450ms ActionSheet dismissals with fluid deceleration curves using
 * pure GPU properties (`transform: translate3d/scale`, `opacity`).
 */

const EASE_ENTER = 'cubic-bezier(0.22, 1, 0.36, 1)';
const EASE_LEAVE = 'cubic-bezier(0.32, 0.72, 0, 1)';

interface ModalAnimationOpts {
  currentBreakpoint?: number;
  backdropBreakpoint?: number;
}

interface NavAnimationOpts {
  enteringEl: HTMLElement;
  leavingEl?: HTMLElement;
  direction?: 'forward' | 'back';
  duration?: number;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function getOverlayRoot(baseEl: HTMLElement): DocumentFragment | HTMLElement {
  return baseEl.shadowRoot ?? baseEl;
}

function getIonPageElement(element: HTMLElement): HTMLElement {
  if (element.classList.contains('ion-page')) {
    return element;
  }
  const ionPage = element.querySelector<HTMLElement>(':scope > .ion-page, :scope > ion-nav, :scope > ion-tabs');
  return ionPage ?? element;
}

/**
 * Smooth Modal & Bottom Sheet Enter Animation.
 * Automatically preserves Ionic sheet modal `currentBreakpoint` positioning.
 */
export function qocModalEnterAnimation(baseEl: HTMLElement, opts?: ModalAnimationOpts): Animation {
  const reduced = prefersReducedMotion();
  const root = getOverlayRoot(baseEl);
  const backdrop = root.querySelector('ion-backdrop');
  const wrapper = root.querySelector('.modal-wrapper');
  const currentBreakpoint = opts?.currentBreakpoint;

  const baseAnim = createAnimation().addElement(baseEl);

  if (currentBreakpoint !== undefined) {
    // Bottom Sheet Modal (e.g. WaPreviewModal)
    const targetOffset = 100 - currentBreakpoint * 100;
    const showBackdrop = opts?.backdropBreakpoint === undefined || currentBreakpoint > opts.backdropBreakpoint;

    baseAnim.easing(EASE_LEAVE).duration(reduced ? 120 : 320);

    if (backdrop) {
      baseAnim.addAnimation(
        createAnimation()
          .addElement(backdrop)
          .fromTo('opacity', '0.01', showBackdrop ? 'var(--backdrop-opacity, 0.36)' : '0.01')
          .beforeStyles({ 'pointer-events': 'none' })
          .afterClearStyles(['pointer-events']),
      );
    }

    if (wrapper) {
      baseAnim.addAnimation(
        createAnimation()
          .addElement(wrapper)
          .beforeStyles({ opacity: '1', 'will-change': 'transform' })
          .afterClearStyles(['will-change'])
          .fromTo('transform', 'translate3d(0, 100%, 0)', `translate3d(0, ${targetOffset}%, 0)`),
      );
    }

    return baseAnim;
  }

  // Full-Screen Form Modal (DsFormModal)
  baseAnim.easing(EASE_ENTER).duration(reduced ? 110 : 290);

  if (backdrop) {
    baseAnim.addAnimation(
      createAnimation()
        .addElement(backdrop)
        .fromTo('opacity', '0.01', 'var(--backdrop-opacity, 0.32)')
        .beforeStyles({ 'pointer-events': 'none' })
        .afterClearStyles(['pointer-events']),
    );
  }

  if (wrapper) {
    baseAnim.addAnimation(
      createAnimation()
        .addElement(wrapper)
        .beforeStyles({ 'will-change': 'transform, opacity' })
        .afterClearStyles(['will-change'])
        .keyframes(
          reduced
            ? [
                { offset: 0, opacity: '0.01', transform: 'translate3d(0, 0, 0)' },
                { offset: 1, opacity: '1', transform: 'translate3d(0, 0, 0)' },
              ]
            : [
                { offset: 0, opacity: '0.01', transform: 'translate3d(0, 42px, 0) scale(0.985)' },
                { offset: 1, opacity: '1', transform: 'translate3d(0, 0, 0) scale(1)' },
              ],
        ),
    );
  }

  return baseAnim;
}

/**
 * Smooth Modal & Bottom Sheet Leave Animation.
 * Uses smooth deceleration (`EASE_LEAVE`) instead of Ionic MD's abrupt ease-in snap.
 */
export function qocModalLeaveAnimation(baseEl: HTMLElement, opts?: ModalAnimationOpts): Animation {
  const reduced = prefersReducedMotion();
  const root = getOverlayRoot(baseEl);
  const backdrop = root.querySelector('ion-backdrop');
  const wrapper = root.querySelector('.modal-wrapper');
  const currentBreakpoint = opts?.currentBreakpoint;

  const baseAnim = createAnimation().addElement(baseEl).easing(EASE_LEAVE);

  if (currentBreakpoint !== undefined) {
    // Bottom Sheet Modal dismissal
    const startOffset = 100 - currentBreakpoint * 100;
    baseAnim.duration(reduced ? 100 : 250);

    if (backdrop) {
      baseAnim.addAnimation(
        createAnimation().addElement(backdrop).fromTo('opacity', 'var(--backdrop-opacity, 0.36)', '0'),
      );
    }

    if (wrapper) {
      baseAnim.addAnimation(
        createAnimation()
          .addElement(wrapper)
          .beforeStyles({ 'will-change': 'transform' })
          .afterClearStyles(['will-change'])
          .fromTo('transform', `translate3d(0, ${startOffset}%, 0)`, 'translate3d(0, 100%, 0)'),
      );
    }

    return baseAnim;
  }

  // Full-Screen Form Modal dismissal
  baseAnim.duration(reduced ? 100 : 230);

  if (backdrop) {
    baseAnim.addAnimation(
      createAnimation().addElement(backdrop).fromTo('opacity', 'var(--backdrop-opacity, 0.32)', '0'),
    );
  }

  if (wrapper) {
    baseAnim.addAnimation(
      createAnimation()
        .addElement(wrapper)
        .beforeStyles({ 'will-change': 'transform, opacity' })
        .afterClearStyles(['will-change'])
        .keyframes(
          reduced
            ? [
                { offset: 0, opacity: '1', transform: 'translate3d(0, 0, 0)' },
                { offset: 1, opacity: '0', transform: 'translate3d(0, 0, 0)' },
              ]
            : [
                { offset: 0, opacity: '1', transform: 'translate3d(0, 0, 0) scale(1)' },
                { offset: 1, opacity: '0', transform: 'translate3d(0, 32px, 0) scale(0.985)' },
              ],
        ),
    );
  }

  return baseAnim;
}

/**
 * Smooth Bottom Action Sheet Enter Animation (e.g. "+ Baru" document sheet).
 */
export function qocActionSheetEnterAnimation(baseEl: HTMLElement): Animation {
  const reduced = prefersReducedMotion();
  const backdrop = baseEl.querySelector('ion-backdrop');
  const wrapper = baseEl.querySelector('.action-sheet-wrapper');

  const baseAnim = createAnimation()
    .addElement(baseEl)
    .easing(EASE_ENTER)
    .duration(reduced ? 100 : 270);

  if (backdrop) {
    baseAnim.addAnimation(
      createAnimation()
        .addElement(backdrop)
        .fromTo('opacity', '0.01', 'var(--backdrop-opacity, 0.36)')
        .beforeStyles({ 'pointer-events': 'none' })
        .afterClearStyles(['pointer-events']),
    );
  }

  if (wrapper) {
    baseAnim.addAnimation(
      createAnimation()
        .addElement(wrapper)
        .beforeStyles({ 'will-change': 'transform' })
        .afterClearStyles(['will-change'])
        .fromTo('transform', 'translate3d(0, 100%, 0)', 'translate3d(0, 0, 0)'),
    );
  }

  return baseAnim;
}

/**
 * Smooth Bottom Action Sheet Leave Animation (snappy 210ms instead of Ionic's sluggish 450ms).
 */
export function qocActionSheetLeaveAnimation(baseEl: HTMLElement): Animation {
  const reduced = prefersReducedMotion();
  const backdrop = baseEl.querySelector('ion-backdrop');
  const wrapper = baseEl.querySelector('.action-sheet-wrapper');

  const baseAnim = createAnimation()
    .addElement(baseEl)
    .easing(EASE_LEAVE)
    .duration(reduced ? 90 : 210);

  if (backdrop) {
    baseAnim.addAnimation(
      createAnimation().addElement(backdrop).fromTo('opacity', 'var(--backdrop-opacity, 0.36)', '0'),
    );
  }

  if (wrapper) {
    baseAnim.addAnimation(
      createAnimation()
        .addElement(wrapper)
        .beforeStyles({ 'will-change': 'transform' })
        .afterClearStyles(['will-change'])
        .fromTo('transform', 'translate3d(0, 0, 0)', 'translate3d(0, 100%, 0)'),
    );
  }

  return baseAnim;
}

/**
 * Smooth Confirmation Dialog (IonAlert) Enter Animation.
 */
export function qocAlertEnterAnimation(baseEl: HTMLElement): Animation {
  const reduced = prefersReducedMotion();
  const backdrop = baseEl.querySelector('ion-backdrop');
  const wrapper = baseEl.querySelector('.alert-wrapper');

  const baseAnim = createAnimation()
    .addElement(baseEl)
    .easing(EASE_ENTER)
    .duration(reduced ? 90 : 220);

  if (backdrop) {
    baseAnim.addAnimation(
      createAnimation()
        .addElement(backdrop)
        .fromTo('opacity', '0.01', 'var(--backdrop-opacity, 0.34)')
        .beforeStyles({ 'pointer-events': 'none' })
        .afterClearStyles(['pointer-events']),
    );
  }

  if (wrapper) {
    baseAnim.addAnimation(
      createAnimation()
        .addElement(wrapper)
        .keyframes(
          reduced
            ? [
                { offset: 0, opacity: '0.01', transform: 'scale(1)' },
                { offset: 1, opacity: '1', transform: 'scale(1)' },
              ]
            : [
                { offset: 0, opacity: '0.01', transform: 'translate3d(0, 8px, 0) scale(0.93)' },
                { offset: 1, opacity: '1', transform: 'translate3d(0, 0, 0) scale(1)' },
              ],
        ),
    );
  }

  return baseAnim;
}

/**
 * Smooth Confirmation Dialog (IonAlert) Leave Animation.
 */
export function qocAlertLeaveAnimation(baseEl: HTMLElement): Animation {
  const reduced = prefersReducedMotion();
  const backdrop = baseEl.querySelector('ion-backdrop');
  const wrapper = baseEl.querySelector('.alert-wrapper');

  const baseAnim = createAnimation()
    .addElement(baseEl)
    .easing(EASE_LEAVE)
    .duration(reduced ? 80 : 170);

  if (backdrop) {
    baseAnim.addAnimation(
      createAnimation().addElement(backdrop).fromTo('opacity', 'var(--backdrop-opacity, 0.34)', '0'),
    );
  }

  if (wrapper) {
    baseAnim.addAnimation(
      createAnimation()
        .addElement(wrapper)
        .keyframes(
          reduced
            ? [
                { offset: 0, opacity: '1', transform: 'scale(1)' },
                { offset: 1, opacity: '0', transform: 'scale(1)' },
              ]
            : [
                { offset: 0, opacity: '1', transform: 'translate3d(0, 0, 0) scale(1)' },
                { offset: 1, opacity: '0', transform: 'translate3d(0, 6px, 0) scale(0.95)' },
              ],
        ),
    );
  }

  return baseAnim;
}

/**
 * Smooth Page Route Transition Animation (GPU horizontal glide + fade).
 * Replaces Ionic MD's chunky vertical `translateY(40px)` + ease-in back snap.
 */
export function qocNavAnimation(_: HTMLElement, opts?: NavAnimationOpts): Animation {
  const rootTransition = createAnimation();
  if (!opts?.enteringEl) return rootTransition;

  const reduced = prefersReducedMotion();
  const isBack = opts.direction === 'back';
  const enteringPage = getIonPageElement(opts.enteringEl);

  rootTransition
    .addElement(enteringPage)
    .fill('both')
    .beforeRemoveClass('ion-page-invisible')
    .duration(opts.duration || (reduced ? 90 : isBack ? 210 : 250))
    .easing(isBack ? EASE_LEAVE : EASE_ENTER);

  if (reduced) {
    rootTransition.fromTo('opacity', '0.01', '1');
  } else if (isBack) {
    rootTransition.fromTo('opacity', '0.94', '1');
  } else {
    rootTransition
      .fromTo('transform', 'translate3d(18px, 0, 0)', 'translate3d(0, 0, 0)')
      .fromTo('opacity', '0.01', '1');
  }

  if (opts.leavingEl && isBack) {
    const leavingPage = createAnimation()
      .addElement(getIonPageElement(opts.leavingEl))
      .onFinish((currentStep) => {
        if (currentStep === 1 && leavingPage.elements.length > 0) {
          leavingPage.elements[0].style.setProperty('display', 'none');
        }
      });

    if (reduced) {
      leavingPage.fromTo('opacity', '1', '0');
    } else {
      leavingPage.fromTo('transform', 'translate3d(0, 0, 0)', 'translate3d(20px, 0, 0)').fromTo('opacity', '1', '0');
    }

    rootTransition.addAnimation(leavingPage);
  }

  return rootTransition;
}
