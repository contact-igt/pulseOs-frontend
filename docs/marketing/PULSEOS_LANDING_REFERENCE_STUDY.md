# PulseOS public site — reference study

Captured 2026-10-05 with a headless Chromium at 1440×900 and 390×844 (fold + full page, scrolled to trigger lazy content;
Avec was additionally paged through its scroll-snap sections). Measurements are computed styles from the live pages.
Screenshots are third-party property and are **not** committed. This is inspiration only: nothing below is copied.

| Site | Reachable | H1 (desktop) | Page height 1440 / 390 | Mobile h-scroll |
|---|---|---|---|---|
| Charis AI | yes | 80px / 600, −3.2px tracking, Urbanist, ~818px wide | 7,462 / 8,657 | none |
| Elevate One X | yes | 281px / 700 (display wordmark), Host Grotesk | 10,091 / 9,234 | none |
| Avi Vashishta | yes | 32px h1 in DOM, visual hero is a ~60px serif headline | 6,168 / 5,293 | none |
| Bevel | yes | 80px / 600, −2.4px tracking, system sans, ~657px wide | 13,538 / 13,216 | none |
| The Product Folks (UnConference) | yes | no `<h1>` element; ~60px condensed display wordmark | 10,021 / 11,903 | none |
| Avec | yes | 64px / 500, −1.6px tracking, gtStandard, ~640px wide | scroll-snap `main` (11,700px inner) | none |

---

## REFERENCE: Avec (avec.ai)

- **Hero approach:** left-biased: 64px headline in two lines, one 12-word sentence, one button, one trust line (store rating). A single rounded canvas on the right holds the real product (a phone with a live card stack). Nothing else above the fold.
- **Typography approach:** medium weight (500), tight tracking (−1.6px), almost no weight contrast. Body 16/24, black on warm off-white.
- **Layout pattern:** full-viewport scroll-snap chapters, each one idea: left text, right large colour-block canvas with the product doing that one thing.
- **Content sequence:** promise → "shows important emails one by one" → voice reply → stack → store CTA. 13 chapters, 1–2 sentences each.
- **Interaction pattern:** the product is the explanation. Copy words fade from grey to black as the chapter advances. A "play the stack challenge" section lets the visitor use the product.
- **Strongest idea:** show the experience instead of describing it. The visitor performs the core action (swipe an email) before reading a feature list.
- **What NOT to copy:** scroll-snap hijacking of the whole page (forces keyboard users and screen readers through 13 stops; a 13-dot side nav replaces normal scrolling), saturated green/blue colour blocks, the phone mock itself.
- **What PulseOS can adapt:** an interactive patient journey where the visitor advances one real PulseOS-looking card through enquiry → call → appointment → arrival → consultation, with copy that is one or two sentences per step.
- **Accessibility / UX weaknesses observed:** scroll hijack with snap + pointer-events handling, motion starts automatically (an explicit pause button exists, which is good), grey-to-black reveal text is low contrast mid-transition, hint text "Scroll or use ↑↓" signals the page is not natively scrollable.

## REFERENCE: Bevel (bevel.health)

- **Hero approach:** centred 80px two-line headline, one sub-line, one dark pill CTA, a rating line, then a huge device composition cropped by the fold. Icy sky-blue environment behind it.
- **Typography approach:** system sans at weight 600, −2.4px tracking, line-height 1.0. Body 17px weight 500, so even the body feels confident.
- **Layout pattern:** contained hero, then alternating full-width "scene" blocks (light / dark / light) each owning one product capability with a large screenshot. A dark chapter for the AI section, a green-dark chapter for privacy.
- **Content sequence:** promise → integrations ("works with") → social proof number → daily-use features → depth ("intelligence") → long tail of small features → privacy → testimonials → final CTA.
- **Interaction pattern:** autoplaying UI videos inside device frames, hover on feature rows, marquee of reviews. Heavy: 146 images and 17 videos.
- **Strongest idea:** the product screenshot is the brand visual. No illustrations at all, large crops of real screens, each with a 2-line caption.
- **What NOT to copy:** the review marquee and star ratings (PulseOS has no public proof yet), autoplay video weight, a download-app CTA pattern, the QR widget.
- **What PulseOS can adapt:** large cropped real screens as the visual identity; a calm sky-blue field in the hero only; a dark "chapter break" used once; "works with" shown honestly as capability states rather than logos.
- **Weaknesses observed:** very long page (13.5k px), motion-heavy, 17 videos is a lot of bytes for a first view, and thin-weight grey sub-text on pale gradients is low contrast.

## REFERENCE: The Product Folks, UnConference 2026

- **Hero approach:** centred stacked display wordmark over a full-bleed illustrated scene, event facts (city, date) as a single chip, one hot-pink CTA.
- **Typography approach:** condensed heavy display type for chapter titles, serif body (PT Serif), all-caps nav and eyebrow. Strong personality, clearly editorial.
- **Layout pattern:** chapter breaks. Each H2 is an event: "Snapshot", "Hosted by veterans", "Legends", "What's in store", "Want to get in?", "Backed by the best", FAQ. Dark ↔ light bands change the mood at each break.
- **Content sequence:** what it is → proof from last year (snapshot) → people → what's new → pricing/passes → sponsors → love → FAQ.
- **Interaction pattern:** mostly static; sticky ticket CTA in the nav; FAQ accordion.
- **Strongest idea:** confident chapter identity. Each section feels like a different "room" and the CTA repeats until the visitor is ready.
- **What NOT to copy:** pink/magenta, illustrated scene, ticket skeuomorph, the sheer volume of photos (175 images).
- **What PulseOS can adapt:** big editorial section headings with a short eyebrow; alternating pale-blue / white / one deep-navy band so the page reads as chapters, not a card stack; repeated primary CTA; a short FAQ.
- **Weaknesses observed:** no `<h1>` in the DOM (screen readers get no page title heading), light-grey text on dark and pink-on-teal contrast risk, decorative images with no obvious alt text strategy.

## REFERENCE: Avi Vashishta (avivashishta.com)

- **Hero approach:** extremely short: a role word ("Game Developer."), one supporting sentence, two buttons, one credibility line. The personality sits in a single 3D character, not in copy.
- **Typography approach:** high-contrast serif for the headline with one italic orange word, DM Sans body.
- **Layout pattern:** centred narrow column, large type, generous empty space, content revealed in sequence (projects → experience).
- **Content sequence:** identity → work → experience → contact. No filler.
- **Interaction pattern:** playful easter eggs (Ctrl+J hint, theme toggle). Fun, but unrelated to the job of the page.
- **Strongest idea:** restraint. The first screen declines to explain everything.
- **What NOT to copy:** 3D mascot, pastel sky art, easter-egg UI, italic accent word (the brief asks for no gradient/accent-text tricks).
- **What PulseOS can adapt:** a hero that has one headline, one sentence, two buttons and one reassurance line; the product canvas carries the rest.
- **Weaknesses observed:** four `<h1>` elements on one page, a floating toast over the hero, 3D canvas × 3 (heavy for the content).

## REFERENCE: Charis AI (thecharisai.com)

- **Hero approach:** left-aligned 80px headline with a blue emphasis on the second line, an eyebrow with a dot, a cloud-photo background and "scroll" cue. No product visual at all.
- **Typography approach:** Urbanist at 600, −3.2px tracking, 0.96 line-height: very tight and very large. Eyebrows are small, wide-tracked caps. Section titles are 2-sentence, parallel ("Systems over chaos. Profit over busywork.").
- **Layout pattern:** a soft icy-blue canvas (#f7fcff) with rounded white cards, a numbered "Seven systems" grid (01–07), and a process list in huge type (AUDIT / BLUEPRINT / BUILD / OPTIMIZE). Ends in one dark rounded CTA panel with contact details.
- **Content sequence:** claim → mission statement paragraph (grey-to-ink scroll reveal) → why → services → process → CTA.
- **Interaction pattern:** word-by-word scroll reveal on the mission paragraph, subtle card lift, dark-mode toggle.
- **Strongest idea:** numbered, calm hierarchy plus one oversized process list. Premium comes from restraint in colour (one blue) and very large type.
- **What NOT to copy:** the "AI automation" positioning, the cloud photography, the "revenue on autopilot" promise.
- **What PulseOS can adapt:** the icy-blue canvas and numbered hierarchy, a chapter built from large type (the "42 enquiries" moment), a single deep CTA panel at the end.
- **Weaknesses observed:** the hero has no product at all, so a visitor cannot tell what it looks like. Large stretches of the page are blank until scroll-triggered reveals fire (nothing visible without JS and scroll). Grey blurred text mid-reveal is unreadable.

## REFERENCE: Elevate One X (elevateonex.com/home)

- **Hero approach:** full-bleed cinematic photograph with a ~280px wordmark (the headline) overlapping the subject; a 2-line descriptor and an "EST." tag; a MENU button only.
- **Typography approach:** a single enormous grotesk plus a hairline all-caps tagline. Wide, tight, theatrical.
- **Layout pattern:** dark theme, video reels, horizontal carousels, testimonial section, FAQ accordion, a repeating "Let's work together." marquee into the footer.
- **Content sequence:** brand statement → proof ("Proof, not promises") → principles → showreel → testimonials → FAQ → CTA marquee.
- **Interaction pattern:** split-character text animation, video hover previews, arrow carousels.
- **Strongest idea:** scale as confidence: a headline so large it becomes an image.
- **What NOT to copy:** stock-portrait photography, dark palette, a 280px headline, a marquee CTA. None of it fits a hospital buyer.
- **What PulseOS can adapt:** large type used as the chapter opener ("Your marketing report says 42 enquiries. What happened to them?") and a clear FAQ close.
- **Weaknesses observed:** split-letter animation duplicates text in the accessibility tree ("M M E E N N U U", "H H o o m m e e" read out by a screen reader), the hero headline is clipped by the photo, seven autoplay videos.

---

## Synthesis for PulseOS

1. **Hero:** one headline, one sentence, two buttons, one reassurance line, and a large real product canvas that is cropped on purpose (Avec + Bevel + Avi).
2. **Rhythm:** chapters with distinct identity and background, not repeated cards (Folks + Charis).
3. **Centrepiece:** one interactive artefact where the visitor moves a patient through the journey and the owner metrics respond (Avec).
4. **Type:** 64–76px confident hero, 48–64px chapter titles, 17–20px body, tight tracking, weight 600 (Bevel/Charis).
5. **Proof:** product proof (capabilities, role views, honest integration states). No ratings, counts or quotes (all six use social proof; PulseOS has none yet).
6. **Avoid the failures found:** no scroll hijack, no split-letter text, content visible without scroll triggers, exactly one `<h1>`, motion that respects `prefers-reduced-motion`, bounded media weight.
