/* eslint-disable react-hooks/rules-of-hooks */
import { Reaction } from "mobx";
import { useRef, useEffect, useDebugValue } from "preact/hooks";

import { printDebugValue } from "./utils/print-debug-value";
import {
  createTrackingData,
  IReactionTracking,
  recordReactionAsCommitted,
  scheduleCleanupOfReactionIfLeaked,
} from "./utils/reaction-cleanup-tracking";
import { isUsingStaticRendering } from "./static-rendering";
import { useForceUpdate } from "./utils/utils";

function observerComponentNameFor(baseComponentName: string) {
  return `observer${baseComponentName}`;
}

export function useObserver<T>(fn: () => T, baseComponentName = "observed"): T {
  if (isUsingStaticRendering()) {
    return fn();
  }

  const forceUpdate = useForceUpdate();

  // StrictMode/ConcurrentMode/Suspense may mean that our component is
  // rendered and abandoned multiple times, so we need to track leaked
  // Reactions.
  const reactionTrackingRef = useRef<IReactionTracking | null>(null);

  if (!reactionTrackingRef.current) {
    // First render for this component (or first time since a previous
    // reaction from an abandoned render was disposed).

    const newReaction = new Reaction(
      observerComponentNameFor(baseComponentName),
      () => {
        // Observable has changed, meaning we want to re-render
        // BUT if we're a component that hasn't yet got to the useEffect()
        // stage, we might be a component that _started_ to render, but
        // got dropped, and we don't want to make state changes then.
        // (It triggers warnings in StrictMode, for a start.)
        if (trackingData.mounted) {
          // We have reached useEffect(), so we're mounted, and can trigger an update
          forceUpdate();
        } else {
          // We haven't yet reached useEffect(), so we'll need to trigger a re-render
          // when (and if) useEffect() arrives.
          trackingData.changedBeforeMount = true;
        }
      }
    );

    const trackingData = createTrackingData(newReaction);
    reactionTrackingRef.current = trackingData;
    scheduleCleanupOfReactionIfLeaked(reactionTrackingRef);
  }

  const { reaction } = reactionTrackingRef.current;
  useDebugValue(reaction, printDebugValue);

  useEffect(() => {
    // Called on first mount only
    recordReactionAsCommitted(reactionTrackingRef);

    if (reactionTrackingRef.current) {
      // Great. We've already got our reaction from our render;
      // all we need to do is to record that it's now mounted,
      // to allow future observable changes to trigger re-renders
      reactionTrackingRef.current.mounted = true;
      // Got a change before first mount, force an update
      if (reactionTrackingRef.current.changedBeforeMount) {
        reactionTrackingRef.current.changedBeforeMount = false;
        forceUpdate();
      }
    } else {
      // The reaction we set up in our render has been disposed.
      // This can be due to bad timings of renderings, e.g. our
      // component was paused for a _very_ long time, and our
      // reaction got cleaned up

      // Re-create the reaction
      reactionTrackingRef.current = {
        reaction: new Reaction(
          observerComponentNameFor(baseComponentName),
          () => {
            // We've definitely already been mounted at this point
            forceUpdate();
          }
        ),
        mounted: true,
        changedBeforeMount: false,
        cleanAt: Infinity,
      };
      forceUpdate();
    }

    return () => {
      reactionTrackingRef.current &&
        reactionTrackingRef.current.reaction.dispose();
      reactionTrackingRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // render the original component, but have the
  // reaction track the observables, so that rendering
  // can be invalidated (see above) once a dependency changes
  let rendering!: T;
  let exception;
  reaction.track(() => {
    try {
      rendering = fn();
    } catch (e) {
      exception = e;
    }
  });

  if (exception) {
    throw exception; // re-throw any exceptions caught during rendering
  }

  return rendering;
}
