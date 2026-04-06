# MyMedInfo — Senior UX Design Review

**Reviewer:** Claude (Senior UX Designer)
**Date:** 6 April 2026
**App:** MyMedInfo — Patient Medication Information Portal
**Stack:** React 19 + TypeScript, Firebase, Vercel

---

## Executive Summary

MyMedInfo is a well-designed NHS patient portal that delivers medication information directly from GP practice SystmOne systems via pre-loaded QR codes. Patients never see the landing page or navigation UI — they arrive at `/patient?code=XXXXX` with medication codes ready to display. This greatly simplifies the design context and eliminates several potential usability issues.

The actual patient experience is **clean and focused**. The main opportunities for improvement are: (1) elevating safety-critical alerts like Sick Day Rules to more urgent visual treatment, (2) strengthening accessibility for elderly/low-literacy users, (3) refining the practice and admin staff workflows, and (4) consolidating visual design inconsistencies.

This review covers **key recommendations** across patient UX (safety), information architecture, practice/admin workflows, visual consistency, and accessibility. Many of the issues flagged are refinements rather than critical flaws, since the MVP design is solid.

---

## 1. Patient Experience (Highest Priority)

The patient view is the primary surface — it's what thousands of people will see after scanning a QR code, often in a moment of uncertainty about their health. Every friction point here matters disproportionately.

### 1.1 The Empty State Empty Grid Should Be Removed in Production

**Issue:** When a patient lands on `/patient` without valid codes (e.g., a broken QR link, or they type the URL manually), they see a browsable grid of *all* medications. While this is useful during internal testing and demos, it's inappropriate for production where patients should never see this view — they arrive via a direct SystmOne link with medication codes pre-loaded.

**Recommendation:** Keep this view for testing/demo purposes only. For production, remove the empty-state grid entirely and show only a clear error message: *"We couldn't find your medication information. Please re-scan the QR code from your GP letter, or contact your practice for help."* This prevents confusion if someone manually navigates to `/patient` without codes.

### 1.2 No Clear Visual Hierarchy Between "New" and "Review" Medications

**Issue:** When a patient sees multiple medications (e.g., one NEW and one REAUTH), the group headings ("New Medications" / "Annual Reviews") use a subtle blue-tinted background that doesn't create enough visual distinction. The badge labels "START" and "REVIEW" are small pills that could easily be missed.

**Recommendation:** Use a stronger colour-coded left border or background tint per group — for example, a bold blue left-border for NEW and a green left-border for REAUTH, matching the badge colours. Make the badge larger (at least 14px font) and consider adding an icon (e.g., a "+" for START, a circular arrow for REVIEW) to reinforce meaning non-verbally.

### 1.3 "Sick Day Rules" Callout Needs Stronger Urgency Design

**Issue:** The sick day rules callout uses a yellow background with a left border — the same visual weight as an informational note. But this is a *safety-critical alert*: patients who ignore it during illness could face serious health consequences.

**Recommendation:** Elevate the visual treatment. Use a red/pink background (like `#fde8e8`) with a red border, a larger alert icon, and bold red heading text. Consider making the "View Sick Day Guide" button red rather than NHS blue. The preview modal already uses this stronger red treatment — the patient view should match it.

### 1.4 "Consultation Summary" Banner Feels Clinical

**Issue:** The summary card says *"Consultation Summary: We found 2 medication guides for you."* The word "consultation" is jargon that doesn't match the patient's mental model — they didn't have a consultation with the app.

**Recommendation:** Simplify to something warmer: *"Your GP has shared 2 medication guides with you."* or *"Here are 2 medication guides from your practice."* This reinforces that the information comes from their trusted GP, not a faceless system.

### 1.5 External Links Lack Sufficient Context

**Issue:** The "Trusted Resources" section links patients to NHS.UK and Trend Diabetes PDFs. The generic copy *"Read the comprehensive medical guide from the NHS website"* and *"Specific leaflet for living well with your medication"* are vague. Patients don't know what they'll find before clicking.

**Recommendation:** Use more descriptive link text that sets expectations: *"How to take [medication name], side effects, and interactions"* for the NHS link. For Trend resources, surface the actual PDF title. Also, add a small "(opens in new tab)" label — many elderly users are confused when a new tab opens unexpectedly.

### 1.6 No "Back to Top" or Navigation Between Sections

**Issue:** When multiple medications are shown, the page can get very long. There's no way for patients to jump between medication cards or return to the summary.

**Recommendation:** Add sticky navigation or a simple "Back to top" floating button. For multi-medication views, consider anchor links in the summary card that jump to each medication section.

### 1.7 Loading State Uses a Rotating Flask Icon

**Issue:** The loading state while validating the practice shows a spinning `FlaskConical` icon. This is a developer/science metaphor that doesn't communicate "loading" to patients. It may even cause anxiety ("is something being tested on me?").

**Recommendation:** Use a simple spinner or pulsing NHS logo. Add reassuring text: *"Loading your medication information..."* rather than just *"Loading..."*

---

## 2. Information Architecture & Navigation

### 2.1 The Landing Page Is Only Useful for Internal/Test Access

**Issue:** The landing page at `/` shows three cards: Admin, Practice, and Demo. Patients never see this — they arrive directly via `/patient?code=...` from SystmOne. This page is appropriate for testing environments, but for production it could be cleaner.

**Recommendation:** In production, consider one of two approaches: (a) Remove the landing page entirely and redirect `/` to a public info page explaining MyMedInfo, then hide Admin and Practice logins behind a `/staff` URL that requires authentication to view, or (b) keep it as-is since patients will never reach it in normal use. This is a low-priority refinement — the current setup works fine for the MVP.

### 2.2 No Global Navigation or Breadcrumbs

**Issue:** Once inside Admin or Practice dashboards, the only way to navigate is browser back or the sign-out button. The Drug Builder has a back arrow but no breadcrumb trail. The header contains only the MyMedInfo logo with no navigation links.

**Recommendation:** Add a minimal nav bar for authenticated users that shows: the current user context (practice name or "Admin"), a link back to the dashboard, and sign out. For the Drug Builder, add a breadcrumb: *Admin Dashboard > Drug Builder*.

### 2.3 The Clinician Demo FAB Appears on Every Page

**Issue:** The floating action button (dark circle with monitor icon) renders on every route, including the landing page, login pages, and admin dashboard. It's only useful on the `/patient` and `/demo` routes for internal testing.

**Recommendation:** Only render `<ClinicianDemo />` on the `/patient` and `/demo` routes. Since the Demo route will likely be removed before production, restrict the FAB to appear only in test/staging environments or behind a feature flag. This ensures it never appears in production patient links via SystmOne.

### 2.4 The Footer Disclaimer Is Easy to Miss

**Issue:** The footer says *"This information is for guidance only. Always follow the specific advice from your GP or clinical team."* This is a critical legal/safety disclaimer, but it's styled at 0.75rem with 0.7 opacity — nearly invisible.

**Recommendation:** Make this more prominent on patient-facing pages. Consider placing it as a card at the bottom of each medication block, or at minimum increase the font size to 0.85rem and opacity to 1.0. For patient pages specifically, use a tinted background to make the disclaimer stand out.

---

## 3. Practice & Admin Workflow Improvements

### 3.1 Practice Dashboard: Two-Panel Layout Creates Scroll Fatigue

**Issue:** The Practice Dashboard shows "Live for Patients" and "Available Medication Library" as two stacked vertical panels. Practice staff must scroll past all active medications to reach the library, and then scroll back up to see updates. With more medications, this becomes painful.

**Recommendation:** Consider a side-by-side layout on desktop: library on the left, active/selected medications on the right. Alternatively, use tabs ("Active Medications" | "Add from Library") to separate the two concerns. This mirrors common e-commerce admin patterns (product catalogue vs. storefront).

### 3.2 No Confirmation Before Removing a Live Medication

**Issue:** Clicking "Remove" on an active medication in the Practice Dashboard immediately deselects it (pending save). There's no confirmation dialog or undo, and the medication just disappears from the "Live" list. If a staff member accidentally removes the wrong one and then hits Save, patients lose access.

**Recommendation:** Add an undo toast ("Sulfonylurea removed. [Undo]") that persists for 5 seconds, or require a confirmation step for removals. At minimum, visually distinguish "pending removal" items with a strikethrough rather than immediately hiding them.

### 3.3 Save Button Position Is Inconsistent

**Issue:** The "Save Changes" button is in the panel header of "Live for Patients" — it's easy to miss, especially on mobile where the header stacks vertically. There's no save button near the library section where users are actually making selection changes.

**Recommendation:** Add a sticky bottom bar that appears whenever there are unsaved changes, showing a summary ("3 medications selected, 1 removed") and a prominent Save button. This is a standard pattern for bulk-edit interfaces and prevents lost work.

### 3.4 Drug Builder: No Autosave or Draft Recovery

**Issue:** The Drug Builder form has many fields. If the admin accidentally navigates away (browser back, clicking "Back to Dashboard"), all unsaved work is lost without warning.

**Recommendation:** Add a `beforeunload` event listener when there are unsaved changes. Consider auto-saving drafts to localStorage or Firestore so work survives accidental navigation. Show a "You have unsaved changes" dialog on navigation attempts.

### 3.5 Drug Builder: The "Generate with AI" Flow Is Opaque

**Issue:** The AI generation button says "Generate with AI" but provides no indication of what the AI will produce, how long it takes, or what quality to expect. If it fails, the error appears as a small yellow bar that's easy to miss.

**Recommendation:** Add a brief helper text: *"AI will generate a draft title, description, key info points, and NHS link based on the medication name. You can edit everything afterward."* Show a progress indicator during generation (not just button text change). On error, use the dashboard error banner pattern for consistency.

### 3.6 Drug Builder: The Catalogue List Gets Unwieldy

**Issue:** The medication catalogue (section 3) shows all medications in a flat list with no search, filter, or pagination. Each entry has 5 action buttons (Preview, Edit, Duplicate, Copy, Delete) rendered as individual inline buttons, creating visual noise.

**Recommendation:** Add a search/filter bar (matching the Practice Dashboard pattern). Consolidate actions into a three-dot overflow menu, keeping only "Edit" and "Preview" as primary actions. Group by category with collapsible sections.

### 3.7 Admin Dashboard: No Search or Filter for Practices

**Issue:** The Practices tab lists all practices without any search or filtering capability. As the PCN grows, finding a specific practice will require manual scrolling.

**Recommendation:** Add a search bar that filters by practice name, ODS code, or email. Add filter chips for Active/Inactive status. This matches the pattern already used in the Practice Dashboard.

### 3.8 Admin Dashboard: "Setup" Tab Is Underused

**Issue:** The Setup tab only contains the sign-up link and a note about the Administrators tab. It feels like a placeholder.

**Recommendation:** Either merge the sign-up link into the Practices tab (as a collapsible section or banner) or expand Setup to include other configuration: default review period, notification settings, SystmOne integration guide, etc. A tab with minimal content trains users to ignore it.

### 3.9 Destructive Actions Use `window.confirm()`

**Issue:** Practice deletion, medication deletion, and admin removal all use the browser's native `confirm()` dialog. This is jarring, unstylable, and inconsistent with the polished UI elsewhere.

**Recommendation:** Build a custom confirmation modal that matches the app's design system. Include the item name in the dialog, differentiate between "deactivate" (reversible) and "delete" (permanent) with colour coding, and require typing the practice/medication name for permanent deletions.

---

## 4. Visual Design & Consistency

### 4.1 Inline Styles Create Maintenance Burden and Inconsistency

**Issue:** The codebase heavily mixes inline styles with CSS classes. The Landing page, Demo page, DrugBuilder, and MedicationPreviewModal all use extensive inline styles with manually-coded hover handlers (`onMouseEnter`/`onMouseLeave`). This creates subtle inconsistencies — for example, the Landing page cards use `#2196F3` (Material blue) while the rest of the app uses `#005eb8` (NHS blue).

**Recommendation:** Migrate all inline styles to the CSS file using the existing NHS design token variables. The Landing page colours should use `var(--nhs-blue)` and `var(--nhs-green)` instead of Material Design colours. Remove all `onMouseEnter`/`onMouseLeave` handlers in favour of CSS `:hover` pseudo-classes.

### 4.2 Landing Page Uses Non-NHS Colours

**Issue:** The Admin card uses `#2196F3` (Google Material Blue), Practice uses `#4CAF50` (Material Green), and Demo uses `#FF9800` (Material Orange). None of these match the NHS colour palette defined in `index.css`. This creates a visual disconnect the moment a user transitions from the landing page to any other screen.

**Recommendation:** Use the existing design tokens: `--nhs-blue` for Admin, `--nhs-green` for Practice, and an appropriate NHS colour for Demo (consider the NHS warm yellow or a tint of blue).

### 4.3 Badge Colour Inconsistency

**Issue:** REAUTH badges appear differently across the app. In `index.css`, `.badge-reauth` uses purple (`#f3e5f5` / `#7b1fa2`). In the DrugBuilder catalogue, REAUTH uses NHS green (`#007f3b`). In the patient view group headings, both types use the same blue-tinted background. The Demo page uses grey for REAUTH.

**Recommendation:** Define a single semantic colour for each badge type and use it everywhere. Suggested: NEW = NHS Blue, REAUTH = NHS Green, GENERAL = NHS Grey. Create CSS utility classes for each and use them consistently across all views.

### 4.4 Button Styles Are Fragmented

**Issue:** There are at least 4 different button patterns: `.action-button`, `.dashboard-pill-button`, inline-styled buttons on Landing/Demo/DrugBuilder, and native `<button>` elements with ad-hoc styles. They have different border-radius values (6px, 8px, 999px), padding, and hover behaviours.

**Recommendation:** Consolidate into 2–3 button variants in CSS: Primary (solid NHS blue), Secondary (outline), and Danger (solid red). Add a Small variant for dashboard actions. Remove all inline button styles.

### 4.5 The Header Adds No Value

**Issue:** The header contains only a small (80px) MyMedInfo logo centred on the page. It takes up significant vertical space but provides no navigation, user context, or functionality.

**Recommendation:** For patient pages, the header is fine — keep it simple and trustworthy. For authenticated pages, add the user's context (practice name or "Admin"), navigation links, and sign-out. Consider making the header sticky on long pages so navigation is always accessible.

### 4.6 Footer Shows on All Pages Including Login

**Issue:** The PCN copyright footer displays on every page, including login screens where it takes up space without adding value.

**Recommendation:** Hide or minimise the footer on login pages. On patient pages, make the disclaimer text more prominent (see 2.4). On dashboard pages, keep it minimal.

---

## 5. Accessibility & Inclusion

Given that MyMedInfo serves NHS patients — many of whom may be elderly, have visual impairments, or have low digital literacy — accessibility isn't a nice-to-have; it's a requirement.

### 5.1 No Skip Navigation Link

**Issue:** There's no "Skip to content" link for screen reader and keyboard users. The header, while minimal, still requires tabbing through before reaching content.

**Recommendation:** Add a visually-hidden skip link as the first focusable element: `<a href="#main-content" class="sr-only">Skip to content</a>`. Add `id="main-content"` to the `<main>` element.

### 5.2 Interactive Divs Lack Keyboard Support

**Issue:** The Landing page cards, Demo medication cards, and Practice Dashboard checkboxes use `<div onClick={...}>` without `role="button"`, `tabIndex`, or `onKeyDown` handlers. These are completely inaccessible to keyboard-only users and invisible to screen readers.

**Recommendation:** Convert all clickable divs to `<button>` elements or `<a>` tags. For the custom checkboxes in the Practice Dashboard, use native `<input type="checkbox">` styled with CSS, or add full ARIA markup (`role="checkbox"`, `aria-checked`, `tabIndex="0"`, keydown handler for Space/Enter).

### 5.3 Modal Focus Trapping Is Missing

**Issue:** Both the MedicationPreviewModal and the ClinicianDemo modal overlay the page but don't trap keyboard focus. A user tabbing through the modal will eventually tab "behind" it into the obscured page content.

**Recommendation:** Implement focus trapping in both modals: on open, move focus to the modal; on tab from the last element, return to the first; on Escape, close. Consider using a library like `focus-trap-react` or implementing it manually.

### 5.4 Colour Contrast Issues

**Issue:** Several text colours may fail WCAG AA contrast requirements against their backgrounds. Specifically: `#4c6272` (secondary text) on `#f0f4f5` (grey background) yields approximately 4.2:1 — just barely passing for normal text but failing for the smaller 0.8rem text sizes used in metadata. The footer at 0.7 opacity will definitely fail.

**Recommendation:** Audit all colour combinations with a contrast checker. Increase secondary text to at least `#3d5261` for small text usage. Remove the footer opacity reduction. Ensure all interactive elements have a minimum 3:1 contrast ratio for their borders/outlines.

### 5.5 No aria-live Regions for Dynamic Content

**Issue:** Success banners ("Medication selections saved successfully"), error messages, and loading states appear dynamically but aren't announced to screen readers.

**Recommendation:** Add `role="alert"` or `aria-live="polite"` to all dynamically-appearing banners and status messages. The loading states should use `aria-busy="true"` on the container.

### 5.6 Form Labels Are Incomplete

**Issue:** Several form inputs lack proper `<label>` associations. The Drug Builder uses `<label>` elements but they're not connected to inputs via `htmlFor`/`id` pairs — they rely on visual proximity. The Practice Dashboard search input has no visible label at all (only a placeholder).

**Recommendation:** Add proper `htmlFor`/`id` associations to all form fields. Add a visible label to the search input (or at minimum an `aria-label`). Ensure every form field can be identified by assistive technology.

### 5.7 Images Have No alt Text

**Issue:** The header logo `<img src="/MyMedinfo.png" alt="MyMedInfo" ... />` has alt text, which is good. However, the icons from lucide-react are decorative SVGs with no `aria-hidden="true"` attribute, which means screen readers may announce them as meaningless image elements.

**Recommendation:** Add `aria-hidden="true"` to all decorative icons. For icons that convey meaning (e.g., the sick day alert icon), add `aria-label` or ensure the adjacent text provides sufficient context.

---

## 6. Quick Wins (Low Effort, High Impact)

These changes can be implemented in a day and would noticeably improve the experience:

1. **Fix Landing page colours** to use NHS design tokens instead of Material Design colours
2. **Move the ClinicianDemo FAB** to only render on test/demo routes, not on admin/practice pages
3. **Add `role="alert"` to all error/success banners** for screen reader support
4. **Replace `window.confirm()` dialogs** with a styled modal component
5. **Add a "Skip to content" link** for keyboard navigation
6. **Convert clickable `<div>`s to `<button>`s** on Landing, Demo, and Practice Dashboard
7. **Increase footer disclaimer visibility** on patient pages (larger font, higher opacity)
8. **Elevate Sick Day Rules styling** to use red/urgent treatment instead of yellow informational

---

## Summary Table

| # | Issue | Severity | Effort | Area | Status |
|---|-------|----------|--------|------|--------|
| 1.1 | Empty state grid (test only) | 🟢 Low | Low | Patient | Test artifact |
| 1.2 | Weak badge visual hierarchy | 🟡 Medium | Medium | Patient | Recommend |
| 1.3 | Sick day callout too subtle | 🔴 High | Low | Patient | Recommend |
| 1.4 | "Consultation Summary" wording | 🟡 Medium | Low | Patient | Recommend |
| 1.5 | Vague external link descriptions | 🟡 Medium | Low | Patient | Recommend |
| 1.6 | No section navigation | 🟢 Low | Medium | Patient | Nice-to-have |
| 1.7 | Flask loading icon | 🟢 Low | Low | Patient | Nice-to-have |
| 2.1 | Landing page design | 🟢 Low | Medium | IA | Low priority |
| 2.2 | No global navigation | 🟡 Medium | Medium | IA | Recommend |
| 2.3 | Demo FAB on all pages | 🟡 Medium | Low | IA | Recommend |
| 2.4 | Invisible footer disclaimer | 🔴 High | Low | IA | Recommend |
| 3.1 | Scroll fatigue on Practice Dashboard | 🟡 Medium | High | Workflow |
| 3.2 | No undo for medication removal | 🟡 Medium | Medium | Workflow |
| 3.3 | Save button position | 🟡 Medium | Medium | Workflow |
| 3.4 | No draft recovery in Drug Builder | 🟡 Medium | Medium | Workflow |
| 3.5 | Opaque AI generation flow | 🟢 Low | Low | Workflow |
| 3.6 | Unwieldy catalogue list | 🟡 Medium | Medium | Workflow |
| 3.7 | No practice search in Admin | 🟡 Medium | Low | Workflow |
| 3.8 | Underused Setup tab | 🟢 Low | Low | Workflow |
| 3.9 | Native confirm dialogs | 🟡 Medium | Medium | Workflow |
| 4.1 | Inline style inconsistencies | 🟡 Medium | High | Visual |
| 4.2 | Non-NHS colours on Landing | 🟡 Medium | Low | Visual |
| 4.3 | Badge colour inconsistency | 🟡 Medium | Medium | Visual |
| 4.4 | Fragmented button styles | 🟡 Medium | Medium | Visual |
| 4.5 | Header lacks utility | 🟢 Low | Medium | Visual |
| 4.6 | Footer on login pages | 🟢 Low | Low | Visual |
| 5.1 | No skip navigation | 🔴 High | Low | A11y |
| 5.2 | Inaccessible clickable divs | 🔴 High | Medium | A11y |
| 5.3 | No modal focus trapping | 🔴 High | Medium | A11y |
| 5.4 | Colour contrast issues | 🟡 Medium | Low | A11y |
| 5.5 | No aria-live regions | 🟡 Medium | Low | A11y |
| 5.6 | Incomplete form labels | 🟡 Medium | Low | A11y |
| 5.7 | Missing aria-hidden on icons | 🟢 Low | Low | A11y |

---

*This review is based on a static code review of the full React codebase. A live usability study with actual NHS patients and practice staff would surface additional issues around comprehension, trust, and task completion that code review alone cannot catch.*
