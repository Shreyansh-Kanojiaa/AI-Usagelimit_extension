// Pure cairo drawing, no shell imports, so it can be rendered standalone.
export const SIZE = 28;

const TAU = 2 * Math.PI;
const GREY = [0.5, 0.5, 0.5];

// inner/outer: used fraction 0..1, or null when unknown (inner) / absent (outer)
// palette: {used, base, ring?, outline?}: RGB arrays; ring outlines the pie when it could vanish on a
// dark bar, outline is the number's shadow opacity
export function draw(cr, inner, outer, palette) {
    const cx = SIZE / 2, cy = 12, r = 9;
    cr.newPath();

    // outer bottom semicircle, filled left -> right
    if (outer !== null) {
        cr.setLineWidth(3);
        cr.setSourceRGBA(1, 1, 1, 0.25);
        cr.arc(cx, cy, 12.5, 0, Math.PI);
        cr.stroke();
        if (outer) {
            cr.setSourceRGBA(...(palette.ring ?? palette.used), 1);
            cr.arcNegative(cx, cy, 12.5, Math.PI, Math.PI - Math.PI * Math.min(outer, 1));
            cr.stroke();
        }
    }

    // inner pie: base = left, used slice clockwise from 12 o'clock
    cr.setSourceRGBA(...(inner === null ? GREY : palette.base), 1);
    cr.arc(cx, cy, r, 0, TAU);
    cr.fill();
    if (inner) {
        cr.setSourceRGBA(...palette.used, 1);
        cr.moveTo(cx, cy);
        cr.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(inner, 1));
        cr.closePath();
        cr.fill();
    }
    if (palette.ring && inner !== null) {
        cr.setLineWidth(1);
        cr.setSourceRGBA(...palette.ring, 1);
        cr.arc(cx, cy, r - 0.5, 0, TAU);
        cr.stroke();
    }

    // percent in the middle, outlined so it reads on any fill
    // (no % sign: 3 digits + % don't fit in an 18px circle)
    const pct = inner === null ? '?' : `${Math.round(inner * 100)}`;
    cr.selectFontFace('Sans', 0, 1);
    cr.setFontSize(pct.length > 2 ? 8 : pct.length > 1 ? 10.5 : 12);
    const e = cr.textExtents(pct);
    const x = cx - e.width / 2 - e.xBearing, y = cy - e.height / 2 - e.yBearing;
    // GJS cairo has no textPath, so fake the outline with offset copies
    cr.setSourceRGBA(0, 0, 0, palette.outline ?? 0.5);
    for (const [dx, dy] of [[-0.7, 0], [0.7, 0], [0, -0.7], [0, 0.7]]) {
        cr.moveTo(x + dx, y + dy);
        cr.showText(pct);
    }
    cr.setSourceRGBA(1, 1, 1, 1);
    cr.moveTo(x, y);
    cr.showText(pct);
}
