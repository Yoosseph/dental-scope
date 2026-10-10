# Scripted onboarding

The first-visit demonstration starts when the core scene is ready. It uses the
existing anatomy dissection, development timeline, search, detail panel, surface
feature controls, tooth dissection and nerve preset. It takes about 75 seconds,
excluding asset loading, and keeps labels on. It first plays the skull/jaw
separation to the In position checkpoint and shows the labelled teeth before
introducing bite development.
The Teeth preset clears surrounding anatomy before focusing the representative
tooth; the camera refits it after the caption and panel positions are measured.
The caption uses the inverse of the app's color theme and provides a prominent
Skip guide button. The top-bar play button replays it. Closing, skipping or pressing Escape
cancels playback and returns to the adult scene; language, theme, numbering and
orbit preferences are retained. The guide records `ds.guide.seen.v1` in local
storage when opened. If storage is blocked, it appears once per mounted session.
Completing the full guide automatically runs the Reset all behavior, returns
to the starting view and closes the overlay. Numbering and orbit settings
return to their defaults; theme and language stay unchanged. There is no
confirmation screen at the end, and the guide can be replayed from the top bar.

`src/app/tour.ts` owns the step data and the reusable, abortable player. A step
declares a caption ID, an optional `data-tour` target, its action, panel, reading
time and optional selection/dissection/loading conditions to await. `playTour`
accepts a script and a UI adapter, so another script can reuse playback without
changing its timing, pause or cancellation logic. Do not use translated labels
or positional CSS selectors as control identities. Add a stable `data-tour`
attribute to the actual control instead. Offscreen controls are scrolled into
view before measurement; desktop/mobile equivalents can share the same target.

`src/ui/GuidedTour.tsx` adapts playback to app state and renders the caption,
cursor and red pen circle. Click steps invoke real control handlers. Search
uses the same store-backed query as the search input. The representative tooth
is preloaded before playback so cancelling during loading cannot select it
later. Asset failures or missing controls offer retry and exploration. Playback
pauses when the page is hidden, supports a manual pause, and respects reduced
motion. Keyboard focus stays in the guide and returns to the replay control.

Hide guide collapses the caption into a fixed Show guide control in the top bar
while the demonstration keeps playing. Restoring it preserves the step, speed
and pause state. The hidden panel contributes no camera clearance. Keyboard
focus moves between the panel and its top-bar control, and Escape still exits
the demonstration while collapsed. New runs start with the panel expanded.

The guide offers 1×, 1.5× and 2× playback. The adapter supplies the current rate,
so changing speed adjusts the current hold without restarting a step. Loading
and layout readiness keep their real-time timeout. Previous/Next and the named
step picker cancel the current run and reconstruct preceding actions through
the same controls, skipping their pointers and reading holds. The requested
step plays normally; manual pause is preserved after its scene is prepared.

The caption avoids the demonstrated control. The app measures it along with
other panels and passes its clearance to the camera, including a top inset on
phones. Resize and position observers keep the anatomy clear as trays change.
Closing the guide removes its clearance. The cursor follows moving controls
imperatively rather than rendering React on every frame. The caption switches
sides only when the control overlaps its bounds; bottom timeline controls do
not move it away from the right. Red outlines use closed paths in pixel
coordinates so their strokes stay complete when a control changes size.

Before the internal tissue levels, the guide enables surface features, selects
the existing Central groove landmark to show its description and sources,
demonstrates facial and biting-surface camera views, then hides the overlay and
uses the tooth breadcrumb to return to the whole tooth. The existing Surface
anatomy controls retain their schematic/draft note and sourced content.
On phones, reading stops temporarily expand the detail sheet using its own
size control. Surface camera demonstrations return it to the compact size so
the crown remains visible.

The Nerves preset frames the displayed dental nerve paths in the space clear
of panels and captions. The nerve step holds that view longer and explains the gold
paths and translucent context. It uses the same preset handler as exploration.

Captions are in `src/i18n/tour.ts` for all five interface languages. Development
steps reuse the existing draft educational descriptions, identify the scene as
schematic and expose its existing medical references. This guide introduces no
new selectable anatomy.

Run `npm test` and `npm run build`. Tests cover playback cancellation, pauses,
missing controls, visit storage, preference preservation, caption coverage,
real component target coverage and camera framing. For visual verification,
replay in desktop and compact layouts, inspect the search and scrolled detail
targets, and let the sequence finish. Check Skip and Escape during playback,
then reload to confirm it does not automatically repeat.
