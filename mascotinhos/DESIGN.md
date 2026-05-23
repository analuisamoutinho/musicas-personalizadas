# Design System Document: The Celebratory Editorial

## 1. Overview & Creative North Star: "The Joyful Curator"
This design system moves away from the static, "grid-locked" nature of typical party planning apps. Instead, it adopts **The Joyful Curator** as its North Star—an editorial approach that treats every screen like a premium, physical invitation. 

We break the "template" look by utilizing intentional asymmetry, overlapping elements, and a high-contrast typography scale. Instead of rigid rows, we use "floating" modules and organic, confetti-like decorative elements to create a sense of movement. The goal is to make the user feel as though they are interacting with a living, breathing celebration rather than a database.

---

## 2. Color & Atmospheric Depth
Our palette is rooted in a "Soft-Vivid" dichotomy. We use a gentle, airy base to allow the high-energy primary and secondary colors to "pop" without overwhelming the user's cognitive load.

### The Palette
*   **Background / Surface:** `surface` (#fff4f5) - The airy, pink-white canvas.
*   **Primary Action:** `primary` (#b10b68) - A sophisticated, deep vivid pink for high-conversion moments.
*   **Secondary Flair:** `secondary` (#005f9c) - Used for sky-blue accents and balanced interaction points.
*   **Highlight:** `tertiary_fixed` (#fcca6d) - Sunny yellow "confetti" moments and high-priority callouts.

### The "No-Line" Rule
To maintain a high-end, modern feel, **1px solid borders are strictly prohibited** for sectioning. Boundaries must be defined through:
1.  **Tonal Shifts:** Placing a `surface_container_low` (#fdedf0) section against the main `surface`.
2.  **Soft Transitions:** Using subtle background shifts to imply a change in context.

### Glass & Gradient Strategy
Main CTAs and Hero sections must not be flat. Apply a subtle linear gradient from `primary` (#b10b68) to `primary_container` (#ff6dad) at a 135-degree angle. For floating navigation or over-content modals, use **Glassmorphism**: a semi-transparent `surface_container_lowest` (#ffffff) with a 12px-20px backdrop-blur to allow the "party" (background confetti) to bleed through.

---

## 3. Typography: Personality & Precision
We pair the exuberant, rounded personality of Baloo 2 (plusJakartaSans proxy) with the functional clarity of Nunito Sans (beVietnamPro proxy).

*   **Display (plusJakartaSans):** Used for "Party Headlines." Use `display-lg` (3.5rem) for hero statements. Apply -2% letter spacing to keep the rounded forms feeling tight and editorial.
*   **Headlines (plusJakartaSans):** Use `headline-md` (1.75rem) for section titles. Ensure these are always in `on_surface` (#352d2f) to maintain readability against the soft pink background.
*   **Body (beVietnamPro):** Use `body-lg` (1rem) for all descriptive text. We prioritize generous line height (1.6) to enhance the "airy" feel.
*   **Labels (beVietnamPro):** Use `label-md` (0.75rem) in all-caps with +5% letter spacing for small categories or tags, creating a "boutique" aesthetic.

---

## 4. Elevation & Depth: The Layering Principle
We convey hierarchy through **Tonal Layering** rather than traditional structural lines or heavy shadows.

*   **Stacking Surfaces:** Instead of shadows, stack containers. Place a `surface_container_lowest` (pure white) card on top of a `surface_container` (#f5e4e8) background. This creates a "soft lift" that feels intentional and premium.
*   **Ambient Shadows:** When an element must float (e.g., a primary FAB), use a hyper-diffused shadow: `box-shadow: 0 20px 40px rgba(177, 11, 104, 0.08)`. Notice the shadow is tinted with the `primary` color, not grey.
*   **The Ghost Border Fallback:** If accessibility requires a border, use the `outline_variant` token at 15% opacity. It should be felt, not seen.

---

## 5. Components & UI Patterns

### Buttons
*   **Primary:** 16px (`DEFAULT`) rounded corners. Gradient fill (`primary` to `primary_container`). White text. High-diffusion shadow on hover.
*   **Secondary:** Ghost style. No background, `secondary` (#005f9c) text, and a `md` (1.5rem) rounded corner.
*   **Interaction:** On press, buttons should scale slightly (98%) to provide tactile feedback.

### Cards & Modules
*   **Rule:** Forbid divider lines.
*   **Layout:** Use the Spacing Scale `6` (2rem) to separate internal card content. Use `surface_container_low` for the card body to create a "sunken" or "raised" effect relative to the page.
*   **Decoration:** Every third card should feature a "Confetti Offset"—a small `tertiary` (#785500) star or circle icon overlapping the top-right corner by 50%.

### Input Fields
*   **Style:** `surface_container_highest` (#ead8dd) background, no border.
*   **Focus State:** A soft 2px outer glow using `secondary_fixed` (#b1d5ff). 
*   **Error:** Use `error` (#b41340) for text, but the container should shift to `error_container` (#f74b6d) at 20% opacity.

### Additional Signature Components
*   **The Celebration Progress Bar:** Instead of a flat line, use a series of staggered circles and stars that "light up" in `tertiary` yellow as the user completes steps.
*   **Floating "Confetti" Accents:** Non-interactive background elements (SVG circles and stars) using `outline_variant` (#b7aaad) at 30% opacity, placed at asymmetrical intervals behind main content blocks.

---

## 6. Do’s and Don'ts

### Do:
*   **Do** use asymmetrical margins. If the left margin is `12` (4rem), try making the right margin `16` (5.5rem) for a modern editorial feel.
*   **Do** overlap images over container edges. It breaks the "box" feel and adds energy.
*   **Do** use the `secondary` sky blue for all functional icons (edit, save, share) to keep them distinct from the `primary` pink brand actions.

### Don’t:
*   **Don’t** use pure black (#000000) for text. Always use `on_surface` (#352d2f) to keep the palette soft and party-ready.
*   **Don’t** use 90-degree corners. Everything must adhere to the `1rem` (16px) or larger rounding scale.
*   **Don’t** use standard "drop shadows." If it doesn't look like a soft glow of colored light, it’s too heavy.