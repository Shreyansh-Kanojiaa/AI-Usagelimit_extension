// Pure cairo drawing, no shell imports, so it can be rendered standalone.
export const SIZE = 28;

const TAU = 2 * Math.PI;
const BLUE = [0.29, 0.64, 1];
const ORANGE = [0.8, 0.47, 0.23];

// session/week: used fraction 0..1, or null when unknown
export function draw(cr, session, week) {
    const cx = SIZE / 2, cy = 12, r = 9;
    cr.newPath();

    // outer bottom semicircle (weekly), filled left -> right
    cr.setLineWidth(3);
    cr.setSourceRGBA(1, 1, 1, 0.25);
    cr.arc(cx, cy, 12.5, 0, Math.PI);
    cr.stroke();
    if (week) {
        cr.setSourceRGBA(...BLUE, 1);
        cr.arcNegative(cx, cy, 12.5, Math.PI, Math.PI - Math.PI * Math.min(week, 1));
        cr.stroke();
    }

    // inner pie (session): orange = left, blue slice = used, clockwise from 12 o'clock
    if (session === null)
        cr.setSourceRGBA(0.5, 0.5, 0.5, 1);
    else
        cr.setSourceRGBA(...ORANGE, 1);
    cr.arc(cx, cy, r, 0, TAU);
    cr.fill();
    if (session) {
        cr.setSourceRGBA(...BLUE, 1);
        cr.moveTo(cx, cy);
        cr.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(session, 1));
        cr.closePath();
        cr.fill();
    }

    // percent in the middle
    // (no % sign: 3 digits + % don't fit in an 18px circle)
    const pct = session === null ? '?' : `${Math.round(session * 100)}`;
    cr.selectFontFace('Sans', 0, 1);
    cr.setFontSize(pct.length > 2 ? 8 : pct.length > 1 ? 10.5 : 12);
    const e = cr.textExtents(pct);
    cr.setSourceRGBA(1, 1, 1, 1);
    cr.moveTo(cx - e.width / 2 - e.xBearing, cy - e.height / 2 - e.yBearing);
    cr.showText(pct);
}
